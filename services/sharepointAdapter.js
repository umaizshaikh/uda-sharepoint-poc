console.log("🔥 sharepointAdapter loaded");

const axios = require("axios");
const crypto = require("crypto");
const { wrapGraphError, wrapError, ProviderError } = require("../errors/ProviderError");

// In-memory store for copy operations (Graph returns 202 + monitor URL)
const copyOperations = new Map();

const DOMAIN = "puneoffice";
const SITE_NAME = "RetinaTeam-AutoCADWebTeam";

const SITE_ID_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const siteIdCache = { value: null, expiresAt: 0 };

function invalidateSiteIdCache() {
  siteIdCache.value = null;
  siteIdCache.expiresAt = 0;
}

function handleAdapterError(err, operation) {
  // Invalidate cache on auth/resource errors
  const status = err.response?.status;
  if (status === 401 || status === 403 || status === 404) {
    invalidateSiteIdCache();
  }
  
  // Wrap Graph API errors as ProviderError
  if (err.response) {
    throw wrapGraphError(err, operation);
  }
  
  // Wrap other errors
  throw wrapError(err, operation);
}

async function getSiteId(accessToken) {
  const now = Date.now();
  if (siteIdCache.value && now < siteIdCache.expiresAt) {
    return siteIdCache.value;
  }

  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${DOMAIN}.sharepoint.com:/sites/${SITE_NAME}:`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const id = response.data.id;
    siteIdCache.value = id;
    siteIdCache.expiresAt = now + SITE_ID_TTL_MS;
    return id;
  } catch (err) {
    console.log("getSiteId ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "getSiteId");
  }
}


// LIST
async function listItems(parentId, accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    const url = parentId
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${parentId}/children`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data.value.map(item => ({
      id: item.id,
      name: item.name,
      type: item.folder ? "folder" : "file",
      parentId: parentId || null,
      size: item.size,
      lastModifiedDateTime: item.lastModifiedDateTime
    }));

  } catch (err) {
    console.log("listItems ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "listItems");
  }
}

async function getAllFolders(accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    return response.data.value
      .filter(item => item.folder)
      .map(item => ({
        id: item.id,
        name: item.name,
        type: "folder",
        parentId: null,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime
      }));
  } catch (err) {
    console.log("getAllFolders ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "getAllFolders");
  }
}

// RENAME
async function renameItem(id, newName, accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    const response = await axios.patch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}`,
      { name: newName },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (err) {
    console.log("renameItem ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "renameItem");
  }
}

// MOVE
async function moveItem(id, targetFolderId, accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    const response = await axios.patch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}`,
      {
        parentReference: {
          id: targetFolderId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (err) {
    console.log("moveItem ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "moveItem");
  }
}

// DELETE
async function deleteItem(id, accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    await axios.delete(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    return { id };
  } catch (err) {
    console.log("deleteItem ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "deleteItem");
  }
}

// UPLOAD (Simple small file upload)
async function uploadItem(name, fileBuffer, targetFolderId, accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    const url = targetFolderId
      ? `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${targetFolderId}:/${name}:/content`
      : `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${name}:/content`;

    const response = await axios.put(url, fileBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream"
      }
    });

    return response.data;
  } catch (err) {
    console.log("uploadItem ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "uploadItem");
  }
}

// COPY (async: Graph returns 202 + Location monitor URL)
function _copyNewName(originalName) {
  const dotIndex = originalName.lastIndexOf(".");
  if (dotIndex > 0) {
    const base = originalName.substring(0, dotIndex);
    const ext = originalName.substring(dotIndex);
    return `${base}_copy${ext}`;
  }
  return `${originalName}_copy`;
}

/**
 * Start copy: calls Graph, accepts 202, stores monitor URL, returns operationId.
 * Client should poll getCopyStatus(operationId) for progress and result.
 */
async function startCopy(id, targetFolderId, accessToken) {
  try {
    const siteId = await getSiteId(accessToken);

    const itemInfo = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const newName = _copyNewName(itemInfo.data.name);

    const response = await axios.post(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}/copy`,
      {
        parentReference: targetFolderId ? { id: targetFolderId } : undefined,
        name: newName
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status === 202
      }
    );

    const monitorUrl = response.headers?.location;
    if (!monitorUrl) {
      throw wrapError(
        new Error("Graph copy did not return 202 with Location header"),
        "startCopy",
        "INVALID_RESPONSE"
      );
    }

    const operationId = crypto.randomUUID();
    copyOperations.set(operationId, {
      monitorUrl,
      newName,
      sourceId: id,
      createdAt: Date.now()
    });

    return { operationId, newName, sourceId: id, monitorUrl };
  } catch (err) {
    console.log("startCopy ERROR:", err.response?.data || err.message);
    handleAdapterError(err, "startCopy");
  }
}

/**
 * Poll Graph monitor URL (no auth required). Returns status and, when done, resourceId.
 */
async function getCopyStatus(operationId) {
  const op = copyOperations.get(operationId);
  if (!op) {
    throw wrapError(
      new Error(`Copy operation ${operationId} not found or expired`),
      "getCopyStatus",
      "OPERATION_NOT_FOUND"
    );
  }

  if (op.completedResult) {
    return op.completedResult;
  }

  try {
    const res = await axios.get(op.monitorUrl, {
      validateStatus: () => true,
      maxRedirects: 0
    });

    if (res.status === 202) {
      const body = res.data || {};
      return {
        status: body.status || "inProgress",
        percentageComplete: body.percentageComplete ?? 0,
        newName: op.newName
      };
    }

    if (res.status === 303 || res.status === 200) {
      let resourceId = res.data?.resourceId;
      if (!resourceId && res.headers?.location) {
        const m = res.headers.location.match(/\/items\/([^/?]+)/);
        if (m) resourceId = m[1];
      }
      const result = {
        status: "completed",
        resourceId,
        newName: op.newName
      };
      op.completedResult = result;
      return result;
    }

    // Unexpected status - wrap as error
    throw wrapError(
      new Error(`Monitor URL returned unexpected status ${res.status}`),
      "getCopyStatus",
      "MONITOR_ERROR"
    );
  } catch (err) {
    if (err instanceof ProviderError) {
      throw err;
    }
    handleAdapterError(err, "getCopyStatus");
  }
}

/** Legacy: start copy and return immediately (for callers that don't use status). */
async function copyItem(id, targetFolderId, accessToken) {
  const { operationId, newName } = await startCopy(id, targetFolderId, accessToken);
  return { id: operationId, name: newName };
}

module.exports = {
  listItems,
  renameItem,
  moveItem,
  deleteItem,
  uploadItem,
  copyItem,
  startCopy,
  getCopyStatus,
  getAllFolders
};
