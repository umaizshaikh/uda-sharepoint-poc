const axios = require("axios");

const getAccessToken = async () => {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
};

const listRootFiles = async () => {
  
  // 1️⃣ Get site info
  const siteResponse = await axios.get(
    "https://graph.microsoft.com/v1.0/sites/puneoffice.sharepoint.com:/sites/AutodeskTeamsinCCTechGuild",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const siteId = siteResponse.data.id;

  // 2️⃣ Get document library (drive)
  const driveResponse = await axios.get(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return driveResponse.data;
};

module.exports = { listRootFiles };
