require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const OperationManager = require("./services/OperationManager");

const app = express();
app.use(express.json());

// A configured secret keeps sessions valid across restarts. The random fallback
// keeps local/dev startup working without reusing the exposed historical value;
// sessions will be invalidated whenever the process restarts without a config.
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set; using a temporary random secret. Set SESSION_SECRET to keep sessions across restarts.");
}

app.use(
  session({
    name: "uda.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

const fileRoutes = require("./routes/files");
app.use("/files", fileRoutes);

app.get("/login", (req, res, next) => {
  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;
  req.session.save((err) => {
    if (err) return next(err);

    const params = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      response_type: "code",
      redirect_uri: "http://localhost:3000/auth/callback",
      response_mode: "query",
      scope: "offline_access Files.ReadWrite Sites.Read.All User.Read",
      state
    });

    res.redirect(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`
    );
  });
});

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

app.get("/auth/callback", async (req, res) => {
  const expectedState = req.session?.oauthState;
  const receivedState = req.query.state;
  if (
    typeof expectedState !== "string" ||
    typeof receivedState !== "string" ||
    expectedState.length !== receivedState.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(receivedState))
  ) {
    return res.status(400).send("Invalid or expired sign-in request. Please try signing in again.");
  }

  const code = req.query.code;
  if (typeof code !== "string" || !code) {
    return res.status(400).send("Sign-in did not return an authorization code. Please try again.");
  }

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

    // Rotate the session identifier after authentication to prevent fixation.
    await regenerateSession(req);
    req.session.accessToken = tokenResponse.data.access_token;
    req.session.refreshToken = tokenResponse.data.refresh_token;
    req.session.expiresAt = Date.now() + (tokenResponse.data.expires_in * 1000);

    req.session.save((err) => {
      if (err) {
        console.error("Could not save authenticated session.");
        return res.status(500).send("Sign-in could not be completed. Please try again.");
      }
      res.redirect("/");
    });
  } catch (err) {
    // Avoid returning identity-provider details or credentials to clients/logs.
    console.error("Microsoft sign-in failed.");
    res.status(500).send("Sign-in failed. Please try again.");
  }
});

app.get("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("uda.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    res.redirect("/login");
  });
});

app.use(express.static("public"));
app.use("/operations", require("./routes/files"));

app.listen(3000, () => {
  console.log("Server running on port 3000");

  // In-memory TTL cleanup for PoC: Remove expired operations every 60 seconds.
  setInterval(() => {
    OperationManager.cleanup(3600000);
  }, 60000);
});
