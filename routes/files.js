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

/**
 * Helper: Handle provider errors consistently
 */
function handleProviderError(err, res, operation = "unknown") {
  if (err instanceof ProviderError) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json(err.toJSON());
  } else {
    // Fallback for non-ProviderError (shouldn't happen, but defensive)
    console.error(`${operation} ERROR (non-ProviderError):`, err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: err.message || "An unexpected error occurred"
      }
    });
  }
}

/**
 * Helper: Get token from session
 */
async function getToken(req, res) {
  try {
    if (!req.session) {
      res.status(401).json({ error: "Session not found" });
      return null;
    }

    const token = await TokenService.getValidAccessToken(req.session);
    return token;

  } catch (err) {
    res.status(401).json({ error: "Authentication expired. Please login again." });
    return null;
  }
}

/**
 * GET - List Files
 */
router.get("/", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const parentId = req.query.parentId || null;

    const files = await fileService.list(parentId, { accessToken: token });
    res.json(files);

  } catch (err) {
    console.error("LIST ERROR:", err);
    handleProviderError(err, res, "list");
  }
});

/**
 * POST - Rename
 */
router.post("/rename", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const { id, newName } = req.body;

    if (!id || !newName) {
      return res.status(400).json({
        error: "id and newName are required"
      });
    }

    const updated = await fileService.rename(id, newName, { accessToken: token });
    res.json(updated);

  } catch (err) {
    console.error("RENAME ERROR:", err);
    handleProviderError(err, res, "rename");
  }
});

// GET all folders recursively (for Move dropdown)
router.get("/folders/all", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const folders = await fileService.getAllFolders({ accessToken: token });
    res.json(folders);

  } catch (err) {
    console.error("FOLDER TREE ERROR:", err);
    handleProviderError(err, res, "getAllFolders");
  }
});


/**
 * POST - Move
 */
router.post("/move", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const { id, targetFolderId } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "id is required"
      });
    }

    const updated = await fileService.move(
      id,
      targetFolderId || null,
      { accessToken: token }
    );

    res.json(updated);

  } catch (err) {
    console.error("MOVE ERROR:", err);
    handleProviderError(err, res, "move");
  }
});

/**
 * POST - Upload (Multipart)
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const file = req.file;
    const targetFolderId = req.body?.targetFolderId || null;

    if (!file) {
      return res.status(400).json({
        error: "No file provided"
      });
    }

    const created = await fileService.upload(
      file.originalname,
      file.buffer,
      targetFolderId,
      { accessToken: token }
    );


    res.json(created);

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    handleProviderError(err, res, "upload");
  }
});

/**
 * POST - Copy (async: returns operationId, poll GET /copy/status/:operationId for progress)
 */
router.post("/copy", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const { id, targetFolderId } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "id is required"
      });
    }

    const result = await fileService.startCopy(
      id,
      targetFolderId || null,
      { accessToken: token }
    );

    res.status(202).json({
      operationId: result.operationId,
      newName: result.newName,
      message: "Copy started. Poll GET /files/copy/status/:operationId for progress and result."
    });
  } catch (err) {
    console.error("COPY ERROR:", err);
    handleProviderError(err, res, "copy");
  }
});

/**
 * GET - Copy operation status (progress and result when completed)
 */
router.get("/copy/status/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;
    const status = await fileService.getCopyStatus(operationId);
    res.json(status);
  } catch (err) {
    console.error("COPY STATUS ERROR:", err);
    handleProviderError(err, res, "getCopyStatus");
  }
});

/**
 * POST - Delete
 */
router.post("/delete", async (req, res) => {
  try {
    const token = await getToken(req, res);
    if (!token) return;

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "id is required"
      });
    }

    const deleted = await fileService.delete(id, { accessToken: token });
    res.json(deleted);

  } catch (err) {
    console.error("DELETE ERROR:", err);
    handleProviderError(err, res, "delete");
  }
});

/**
 * GET - Get operation status by ID
 * Mounted at /operations in server.js, so full path is /operations/:id
 */
router.get('/:id', (req, res) => {
  try {
    const operation = OperationManager.get(req.params.id);

    if (!operation) {
      const error = new ProviderError(
        'OPERATION_NOT_FOUND',
        'Operation not found or expired',
        404
      );
      return res.status(404).json(error.toJSON());
    }

    res.json(operation);
  } catch (err) {
    console.error("GET OPERATION ERROR:", err);
    handleProviderError(err, res, "getOperation");
  }
});

module.exports = router;
