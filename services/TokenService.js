const axios = require("axios");

class TokenService {
  static async getValidAccessToken(session) {
    const now = Date.now();

    // If token still valid (with 1 min buffer)
    if (session.accessToken && now < session.expiresAt - 60000) {
      return session.accessToken;
    }

    if (!session.refreshToken) {
      throw new Error("No refresh token available");
    }

    // Refresh token
    const response = await axios.post(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
        scope: "offline_access Files.ReadWrite Sites.ReadWrite.All Sites.Read.All User.Read"
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    session.accessToken = response.data.access_token;
    session.refreshToken = response.data.refresh_token;
    session.expiresAt = Date.now() + (response.data.expires_in * 1000);

    return session.accessToken;
  }
}

module.exports = TokenService;
