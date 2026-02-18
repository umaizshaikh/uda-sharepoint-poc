require("dotenv").config();
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const path = require("path");
const OperationManager = require("./services/OperationManager");

const app = express();
app.use(express.json());

app.use(
  session({
    secret: "uda-secret",
    resave: false,
    saveUninitialized: false
  })
);

const fileRoutes = require("./routes/files");
app.use("/files", fileRoutes);

app.get("/login", async (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    response_type: "code",
    redirect_uri: "http://localhost:3000/auth/callback",
    response_mode: "query",
    scope: "offline_access Files.ReadWrite Sites.Read.All User.Read"
  });

  res.redirect(
    `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`
  );
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: "http://localhost:3000/auth/callback",
        grant_type: "authorization_code"
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    req.session.refreshToken = tokenResponse.data.refresh_token;
    req.session.expiresAt = Date.now() + (tokenResponse.data.expires_in * 1000);
    // req.session.expiresAt = Date.now() - 1000;

    res.redirect("/");
  } catch (err) {
    console.log("AUTH ERROR:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || err.message);
  }
});

app.get("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.use(express.static("public"));

app.use('/operations', require('./routes/files'));

app.listen(3000, () => {
  console.log("Server running on port 3000");

  // In-memory TTL cleanup for PoC: Remove expired operations every 60 seconds
  // Operations older than 1 hour (3600000ms) are automatically cleaned up
  // This prevents memory leaks in the in-memory operation store
  setInterval(() => {
    OperationManager.cleanup(3600000);
  }, 60000);
});
