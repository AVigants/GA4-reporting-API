const properties = [
  { id: '123', sheetName: 'ABC' },
  { id: '456', sheetName: 'DEF' },
  // more properties
];

const SERVICE_ACCOUNT_EMAIL = "{{SERVICE_ACCOUNT_EMAIL}}";
const PRIVATE_KEY = "{{PRIVATE_KEY}}"
const NOTIF_URL_BASE = `{{NOTIF_URL_BASE}}`;
const notifyFeatureEnabled = true;

function exportGA4DataToSheets() {
  properties.forEach(property => {
    try {
      Logger.log(`[${property.sheetName}] Starting exportGA4DataToSheets function.`);
      const data = fetchRealtimeData(property.id);
      if (!data) {
        Logger.log(`No data returned for property ${property.sheetName}`);
        notify(`No data returned for property ${property.sheetName}`);
        return;
      }

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(property.sheetName) ||
        SpreadsheetApp.getActiveSpreadsheet().insertSheet(property.sheetName);
      sheet.clear(); // Clear existing data before appending new data
      sheet.appendRow(["Datetime", "EventName", "EventCount"]); // Header row

      data.forEach(row => {
        sheet.appendRow([
          getCurrentDatetime(),
          row.dimensionValues[0].value,
          row.metricValues[0].value,
        ]);
      });

      Logger.log(`Data successfully written to sheet for property ${property.sheetName}.`);

    } catch (error) {
      Logger.log(`Couldn't fetch data from property ${property.sheetName}`);
      notify(`Couldn't fetch data from property ${property.sheetName}`);
    }
  });
}

function fetchRealtimeData(propertyId) {
  const reportingApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`;
  const options = {
    method: "post",
    headers: {
      Authorization: `Bearer ${getOAuthToken()}`,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify({
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
    }),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(reportingApiUrl, options);
  const jsonResponse = JSON.parse(response.getContentText());

  if (jsonResponse.error) {
    Logger.log(`Error fetching data for property ${propertyId}: ${jsonResponse.error.message}`);
    notify(`Error fetching data for property ${propertyId}: ${jsonResponse.error.message}`);
    return null;
  }

  return jsonResponse.rows || [];
}

function getCurrentDatetime() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function notify(str) {
  if(!notifyFeatureEnabled){
    return;
  }
  const url = `${NOTIF_URL_BASE}    ${encodeURIComponent(
    `[Google Sheets - Trodo | GA4 Exports]    ${str}`
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
