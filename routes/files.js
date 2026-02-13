const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const filesystem = require("../services/filesystem");

/**
 * Helper: Get token from session
 */
function getToken(req, res) {
  const token = req.session?.accessToken;

  if (!token) {
    res.status(401).json({
      error: "Not authenticated. Please login again."
    });
    return null;
  }

  return token;
}

/**
 * GET - List Files
 */
router.get("/", async (req, res) => {
  try {
    const token = getToken(req, res);
    if (!token) return;

    const parentId = req.query.parentId || null;

    const files = await filesystem.list(parentId, token);
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
    const token = getToken(req, res);
    if (!token) return;

    const { id, newName } = req.body;

    if (!id || !newName) {
      return res.status(400).json({
        error: "id and newName are required"
      });
    }

    const updated = await filesystem.rename(id, newName, token);
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
    const token = getToken(req, res);
    if (!token) return;

    const folders = await filesystem.getAllFolders(token);
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
    const token = getToken(req, res);
    if (!token) return;

    const { id, targetFolderId } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "id is required"
      });
    }

    const updated = await filesystem.move(id, targetFolderId || null, token);
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
    const token = getToken(req, res);
    if (!token) return;

    const file = req.file;
    const targetFolderId = req.body?.targetFolderId || null;

    if (!file) {
      return res.status(400).json({
        error: "No file provided"
      });
    }

    const created = await filesystem.upload(
      file.originalname,
      file.buffer,
      targetFolderId,
      token
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
    const token = getToken(req, res);
    if (!token) return;

    const { id, targetFolderId } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "id is required"
      });
    }

    const copied = await filesystem.copy(id, targetFolderId || null, token);
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
    const token = getToken(req, res);
    if (!token) return;

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "id is required"
      });
    }

    const deleted = await filesystem.remove(id, token);
    res.json(deleted);

  } catch (err) {
    console.error("DELETE ERROR:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
  }
});

module.exports = router;
