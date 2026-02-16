const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const FileService = require("../services/FileService");
const SharePointProvider = require("../providers/SharePointProvider");
const TokenService = require("../services/TokenService");
const provider = new SharePointProvider();
const fileService = new FileService(provider);

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
    console.error("LIST ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
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
    console.error("RENAME ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
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
    console.error("FOLDER TREE ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
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
    console.error("MOVE ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
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
    console.error("UPLOAD ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
  }
});

/**
 * POST - Copy
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

    const copied = await fileService.copy(
      id,
      targetFolderId || null,
      { accessToken: token }
    );

    res.json(copied);

  } catch (err) {
    console.error("COPY ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
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
    console.error("DELETE ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
  }
});

module.exports = router;
