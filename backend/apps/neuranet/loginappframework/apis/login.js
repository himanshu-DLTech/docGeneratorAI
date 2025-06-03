/**
 * Needs Tekmonks Unified Login to work.
 * 
 * Operations are
 *  op - getotk - Returns one time key which can be passed to Unified login 
 *  op - verify - Verifies the incoming JWT. This needs the following params
 *      op: "verify", jwt: "the JWT token from unified login"
 * (C) 2023 TekMonks. All rights reserved.
 */

const path = require("path");
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const httpClient = require(`${CONSTANTS.LIBDIR}/httpClient.js`);

const LOGIN_LISTENERS_MEMORY_KEY = "__org_monkshu_loginapp_login_listeners";
const DB_PATH = (LOGINAPP_CONSTANTS.CONF.db_server_host||"")+`${LOGINAPP_CONSTANTS.DB_DIR}/loginapp.db`.replaceAll(path.sep, path.posix.sep);
const DB_CREATION_SQLS = require(`${LOGINAPP_CONSTANTS.DB_DIR}/loginapp_dbschema.json`);
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

exports.init = async noerror => {try {await db.init();} catch (err) {if (noerror) LOG.error(`Error initializing the DB: ${err}`); else throw err;}}

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
    
    if (jsonReq.op == "getotk") return _getOTK(jsonReq);
    else if (jsonReq.op == "verify") return await _verifyJWT(jsonReq);
    else return CONSTANTS.FALSE_RESULT;
}

exports.isValidLogin = headers => APIREGISTRY.getExtension("JWTTokenManager").checkToken(exports.getToken(headers));
exports.getID = headers => APIREGISTRY.getExtension("JWTTokenManager").getClaims(headers).id;
exports.getRole = headers => APIREGISTRY.getExtension("JWTTokenManager").getClaims(headers).role;
exports.getOrg = headers => APIREGISTRY.getExtension("JWTTokenManager").getClaims(headers).org;
exports.getJWT = headers => APIREGISTRY.getExtension("JWTTokenManager").getToken(headers);
exports.getToken = headers => exports.getJWT(headers);

exports.addLoginListener = (modulePath, functionName) => {
	const loginlisteners = CLUSTER_MEMORY.get(LOGIN_LISTENERS_MEMORY_KEY, []);
	loginlisteners.push({modulePath, functionName});
	CLUSTER_MEMORY.set(LOGIN_LISTENERS_MEMORY_KEY, loginlisteners);
}

exports.getKey = headers => APIREGISTRY.getExtension("apikeychecker").getIncomingAPIKey(headers);

exports.getOrgKeys = async headersOrOrg => {
	const orgIn = typeof headersOrOrg == "string" ? headersOrOrg : exports.getOrg(headersOrOrg);
	return await _getKeysForOrg(orgIn);
}

exports.setOrgKeys = async (headersOrOrg, keys) => {
	const orgIn = typeof headersOrOrg == "string" ? headersOrOrg : exports.getOrg(headersOrOrg);
	return await _setKeysForOrg(keys, orgIn);
}

exports.isAdmin = headers => (exports.getRole(headers))?.toLowerCase() == LOGINAPP_CONSTANTS.ROLES.ADMIN.toLowerCase();

function _getOTK(_jsonReq) {
    return {...CONSTANTS.TRUE_RESULT, otk: serverutils.generateUUID(false)};
}

async function _verifyJWT(jsonReq) {
    let tokenValidationResult; try {
        tokenValidationResult = await httpClient.fetch(`${LOGINAPP_CONSTANTS.CONF.tkmlogin_api}?jwt=${jsonReq.jwt}`);
    } catch (err) {
        LOG.error(`Network error validating JWT token ${jsonReq.jwt}, validation failed. Error is ${err}`);
        return CONSTANTS.FALSE_RESULT;
    }

	if (!tokenValidationResult.ok) {
        LOG.error(`Fetch error validating JWT token ${jsonReq.jwt}, validation failed.`);
        return CONSTANTS.FALSE_RESULT;
    }

    const responseJSON = await tokenValidationResult.json();
    if ((!responseJSON.result) || (responseJSON.jwt != jsonReq.jwt)) {
        LOG.error(`Validation error when validating JWT token ${jsonReq.jwt}.`);
        return CONSTANTS.FALSE_RESULT;
    }

    try {
        const _decodeBase64 = string => Buffer.from(string, "base64").toString("utf8");
        const jwtClaims = JSON.parse(_decodeBase64(jsonReq.jwt.split(".")[1]));
        const finalResult = {...jwtClaims, org: jwtClaims.org.toLowerCase(), role: jwtClaims.role, ...CONSTANTS.TRUE_RESULT, tokenflag: true};
		await _informLoginListeners(finalResult);
        return finalResult;
    } catch (err) {
        LOG.error(`Bad JWT token passwed for login ${jsonReq.jwt}, validation succeeded but decode failed. Error is ${err}`);
        return CONSTANTS.FALSE_RESULT;
    }
}

const _informLoginListeners = async result => {
	const loginlisteners = CLUSTER_MEMORY.get(LOGIN_LISTENERS_MEMORY_KEY, []);
	for (const listener of loginlisteners) {
		const listenerFunction = require(listener.modulePath)[listener.functionName];
        const listenerFunctionResult = await listenerFunction(result);
		if (!listenerFunctionResult) return false; 
	}
    return true;
}

async function _getKeysForOrg(org) {
	const keys = await db.getQuery("SELECT key FROM keys WHERE org = ? COLLATE NOCASE", [org]);
	if (keys && keys.length) return _flattenArray(keys, "key"); else return null;
}

async function _setKeysForOrg(keys, org) {
	if (!keys) keys = [serverutils.generateUUID(false)];
	const keysIn = (!Array.isArray(keys)) ? [keys] : [...keys];

	const commandsToUpdate = [{cmd: "DELETE FROM keys WHERE org = ? COLLATE NOCASE", params: [org]}];	// drop all current keys
	for (const key of keysIn) commandsToUpdate.push({cmd:"INSERT INTO KEYS (key, org) VALUES (?, ?)", params: [key, org]});
	const updateResult = await db.runTransaction(commandsToUpdate);
	if (!updateResult) return false; else return keysIn;
}


const validateRequest = jsonReq => jsonReq && ((jsonReq.op=="verify" && jsonReq.jwt) || jsonReq.op=="getotk");
