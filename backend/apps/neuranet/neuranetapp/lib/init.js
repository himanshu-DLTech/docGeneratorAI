/**
 * Shows how to init apps embedded into the login app.
 * (C) 2023 TekMonks. All rights reserved.
 */

const fs = require("fs");
const mustache = require("mustache");
const NEURANET_CONSTANTS = LOGINAPP_CONSTANTS.ENV.NEURANETAPP_CONSTANTS;

exports.initSync = _ => {
    _readConfSync();    // the files below need constants to be setup properly so require them after conf is setup

    const events = require(`${NEURANET_CONSTANTS.APIDIR}/events.js`);
    const aidbfs = require(`${NEURANET_CONSTANTS.LIBDIR}/aidbfs.js`);
    const dblayer = require(`${NEURANET_CONSTANTS.LIBDIR}/dblayer.js`);
    const fileindexer = require(`${NEURANET_CONSTANTS.LIBDIR}/fileindexer.js`);
    const loginhandler = require(`${NEURANET_CONSTANTS.LIBDIR}/loginhandler.js`);
    const brainhandler = require(`${NEURANET_CONSTANTS.LIBDIR}/brainhandler.js`);
    const textextractor = require(`${NEURANET_CONSTANTS.LIBDIR}/textextractor.js`);

    dblayer.initDBAsync(true); // yes this is async so there is a slim chance by the first call it is still loading
    loginhandler.initSync(); 
    fileindexer.initSync();
    events.initSync();
    brainhandler.initSync();
    aidbfs.initSync();
    textextractor.initAsync();  // yes this is async so there is a slim chance by the first call it is still loading
}

function _readConfSync() {
    const confjson = mustache.render(fs.readFileSync(`${NEURANET_CONSTANTS.CONFDIR}/neuranet.json`, "utf8"), 
        {...NEURANET_CONSTANTS, hostname: LOGINAPP_CONSTANTS.HOSTNAME}).replace(/\\/g, "\\\\");   // escape windows paths
    NEURANET_CONSTANTS.CONF = JSON.parse(confjson);
    global.NEURANET_CONSTANTS = NEURANET_CONSTANTS;
}