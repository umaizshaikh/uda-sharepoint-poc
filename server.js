require("dotenv").config();
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const path = require("path");

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

app.get("/login", (req, res) => {
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

    req.session.accessToken = tokenResponse.data.access_token;

    res.redirect("/");
  } catch (err) {
    console.log("AUTH ERROR:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || err.message);
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.use(express.static("public"));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
