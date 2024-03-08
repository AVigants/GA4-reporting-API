// for a list of valid dimensions, see: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
const GA_PROPERTY_ID = ""; //Property ID of the property, not the measurement ID. Go to GA4 -> admin -> property -> property details
const SERVICE_ACCOUNT_EMAIL = "";
const PRIVATE_KEY = "";

function exportGA4DataToSheet() {
    Logger.log("Starting exportGA4DataToSheet function.");
    const metrics = [{ name: "eventCount" }];
    const dimensions = [{ name: "eventName" }];

    const reportingApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runRealtimeReport`;

    const options = {
        method: "post",
        headers: {
            Authorization: `Bearer ${getOAuthToken()}`,
            "Content-Type": "application/json",
        },
        payload: JSON.stringify({
            dimensions: dimensions,
            metrics: metrics,
        }),
        muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(reportingApiUrl, options);
    const jsonResponse = JSON.parse(response.getContentText());

    if (jsonResponse.error) {
        Logger.log("Error in response: " + jsonResponse.error.message);
        return;
    }

    const rows = jsonResponse.rows || [];

    if (rows.length > 0) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        // sheet.clear(); // Clear existing data before appending new data
        // sheet.appendRow(["datetime", "eventName", "eventCount"]); // Header row
        rows.forEach((row) => {
            sheet.appendRow([
                getCurrentDatetime(),
                row.dimensionValues[0].value,
                row.metricValues[0].value,
            ]);
        });
        Logger.log("Data successfully written to sheet.");
        notify(`Job done.`);
    } else {
        Logger.log("No data returned for today.");
    }
}

function getCurrentDatetime() {
    const now = new Date();
    const formattedDatetime = Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm:ss"
    );

    return formattedDatetime;
}

// make a simple GET request
function notify(str) {
    const base = ``;
    const url = `${base}    ${encodeURIComponent(
        `[Google Sheets]    ${str}`
    )}`;
    try {
        UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    } catch (error) {
        Logger.log(`Error sending notification: ${error}`);
    }
}

function getOAuthToken() {
    Logger.log("Generating OAuth token."); // Log start of token generation
    const jwt = {
        alg: "RS256",
        typ: "JWT",
    };
    const claimSet = {
        iss: SERVICE_ACCOUNT_EMAIL,
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    };

    const encodedJwt =
        Utilities.base64EncodeWebSafe(JSON.stringify(jwt)) +
        "." +
        Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
    const signature = Utilities.computeRsaSha256Signature(
        encodedJwt,
        PRIVATE_KEY
    );
    const jwtWithSignature =
        encodedJwt + "." + Utilities.base64EncodeWebSafe(signature);

    const tokenResponse = UrlFetchApp.fetch(
        "https://oauth2.googleapis.com/token",
        {
            method: "post",
            payload: {
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwtWithSignature,
            },
        }
    );

    const accessToken = JSON.parse(tokenResponse.getContentText()).access_token;
    Logger.log("OAuth token generated successfully."); // Log successful token generation
    return accessToken;
}
