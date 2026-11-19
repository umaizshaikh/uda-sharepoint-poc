const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const FileService = require("../services/FileService");
const SharePointProvider = require("../providers/SharePointProvider");
const TokenService = require("../services/TokenService");
const { ProviderError } = require("../errors/ProviderError");
const OperationManager = require("../services/OperationManager");
const provider = new SharePointProvider();
const fileService = new FileService(provider);

function handleProviderError(err, res, operation = "unknown") {
  if (err instanceof ProviderError) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json(err.toJSON());
  }

  // Do not write full errors: upstream error objects may contain sensitive data.
  console.error(`${operation} request failed.`);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" }
  });
}

async function getToken(req, res) {
  try {
    if (!req.session) {
      res.status(401).json({ error: "Authentication required." });
      return null;
    }

    return await TokenService.getValidAccessToken(req.session);
  } catch {
    res.status(401).json({ error: "Authentication expired. Please sign in again." });
    return null;
  }
}

// The token is stored in the server-side session and came from Microsoft OAuth.
// Use its stable object identifier to keep operation status private to its owner.
function getUserId(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.oid || payload.sub || null;
  } catch {
    return null;
  }
}

function notFound(res) {
  return res.status(404).json({
    error: { code: "OPERATION_NOT_FOUND", message: "Operation not found or expired" }
  });
}

router.get("/", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const files = await fileService.list(req.query.parentId || null, { accessToken: token });
    res.json(files);
  } catch (err) {
    handleProviderError(err, res, "list");
  }
});

router.post("/rename", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const { id, newName } = req.body;
    if (!id || !newName) return res.status(400).json({ error: "id and newName are required" });
    const context = { accessToken: token, userId: getUserId(token) };
    res.json(await fileService.rename(id, newName, context));
  } catch (err) {
    handleProviderError(err, res, "rename");
  }
});

router.get("/folders/all", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    res.json(await fileService.getAllFolders({ accessToken: token }));
  } catch (err) {
    handleProviderError(err, res, "getAllFolders");
  }
});

router.post("/move", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const { id, targetFolderId } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });
    const context = { accessToken: token, userId: getUserId(token) };
    res.json(await fileService.move(id, targetFolderId || null, context));
  } catch (err) {
    handleProviderError(err, res, "move");
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });
    const context = { accessToken: token, userId: getUserId(token) };
    const created = await fileService.upload(
      file.originalname,
      file.buffer,
      req.body?.targetFolderId || null,
      context
    );
    res.json(created);
  } catch (err) {
    handleProviderError(err, res, "upload");
  }
});

router.post("/copy", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const { id, targetFolderId } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });
    const context = { accessToken: token, userId: getUserId(token) };
    const result = await fileService.copy(id, targetFolderId || null, context);
    res.status(202).json({
      operationId: result.operationId,
      newName: result.newName,
      message: "Copy started. Poll GET /files/copy/status/:operationId or GET /operations/:id for progress and result."
    });
  } catch (err) {
    handleProviderError(err, res, "copy");
  }
});

router.get("/copy/status/:operationId", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const operation = OperationManager.get(req.params.operationId);
    if (!operation || operation.metadata?.userId !== getUserId(token)) return notFound(res);
    res.json(operation);
  } catch (err) {
    handleProviderError(err, res, "getCopyStatus");
  }
});

router.post("/delete", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });
    const context = { accessToken: token, userId: getUserId(token) };
    res.json(await fileService.delete(id, context));
  } catch (err) {
    handleProviderError(err, res, "delete");
  }
});

// Operation IDs are not a substitute for authorization: require the signed-in
// owner and return the same not-found response for absent and foreign IDs.
router.get("/:id", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;
    const operation = OperationManager.get(req.params.id);
    if (!operation || operation.metadata?.userId !== getUserId(token)) return notFound(res);
    res.json(operation);
  } catch (err) {
    handleProviderError(err, res, "getOperation");
  }
});

module.exports = router;
