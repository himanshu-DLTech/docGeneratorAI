const NEURANET_CONSTANTS = LOGINAPP_CONSTANTS.ENV.NEURANETAPP_CONSTANTS;
const texttopdf = require(`${NEURANET_CONSTANTS.THIRDPARTYDIR}/texttopdf.js`);

exports.formatResponse = async (params) => {
    if (isTenderResponse) return await addTenderDownloadButton(params);
    else return await parseJSON(params);
}

async function parseJSON(params) {
    const airesponse = params?.airesponse;
    try {
        let responseStr = typeof airesponse.response === "string"
            ? airesponse.response
            : JSON.stringify(airesponse.response);

        responseStr = cleanBackslashes(responseStr);
        const jsonPattern = /```json\s*([\s\S]*?)```/i;
        const match = responseStr.match(jsonPattern);
        const parsed = match ? JSON.parse(match[1]) : JSON.parse(responseStr);

        airesponse.response = parsed;
        return airesponse;
    } catch (e) {
        LOG.info("Sanitize JSON plugin: Failed to parse AI response as JSON, returning original response.");
        return airesponse;
    }
}

const addTenderDownloadButton = async (params) => {
    const pdfBuffer = await texttopdf.textToPDF(params.airesponse.response.split("NEURANET GENERATED DOCUMENT")[1].trim());
    const base64PDF = pdfBuffer.toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${base64PDF}`;
    const downloadLink = `<a href="${pdfDataUrl}" download="${params.filename || 'generated-document.pdf'}" class="pdf-download-link">Download PDF</a>`;
    params.airesponse.response = `${params.airesponse.response}\n\n${downloadLink}`
    return params.airesponse;
}

const cleanBackslashes = str => str.replace(/\\n/g, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

const isTenderResponse = params => params.airesponse && params.airesponse.response.includes("NEURANET GENERATED DOCUMENT");