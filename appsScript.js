const properties = [
  { id: 'GA4-property-1', sheetName: 'sheetName1' },
  { id: 'GA4-property-2', sheetName: 'sheetName2' },
    // ... other GA4 properties
];

const SERVICE_ACCOUNT_EMAIL = "something@something.com";
const PRIVATE_KEY =
  "-----BEGIN PRIVATE KEY-----    {{PRIVATE KEY}}    -----END PRIVATE KEY-----\n";

function exportGA4DataToSheets() {
  Logger.log("Starting exportGA4DataToSheets function.");
  properties.forEach(property => {
    const data = fetchRealtimeData(property.id);
    if (!data) {
      Logger.log(`No data returned for property ${property.id}`);
      notify(`No data returned for property ${property.id}`);
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

    Logger.log(`Data successfully written to sheet for property ${property.id}.`);
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
    // Make a GET request to a server:
  const base = `{{URL BASE}}`;
  const url = `${base}    ${encodeURIComponent(
    `[Google Sheets | GA4 Exports]    ${str}`
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
