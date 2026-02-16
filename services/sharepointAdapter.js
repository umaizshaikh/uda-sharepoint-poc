console.log("🔥 sharepointAdapter loaded");

const axios = require("axios");

const DOMAIN = "puneoffice"; 
const SITE_NAME = "RetinaTeam-AutoCADWebTeam";

// Get SharePoint Site ID
async function getSiteId(accessToken) {
  console.log("🔥 getSiteId CALLED");

  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${DOMAIN}.sharepoint.com:/sites/${SITE_NAME}:`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }

    );

    return response.data.id;

  } catch (err) {
    console.log("getSiteId ERROR:", err.response?.data || err.message);
    throw err;
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
    throw err;
  }
}

async function getAllFolders(accessToken) {
  const siteId = await getSiteId(accessToken);

  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
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

}

// RENAME
async function renameItem(id, newName, accessToken) {
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
}

// MOVE
async function moveItem(id, targetFolderId, accessToken) {
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
}

// DELETE
async function deleteItem(id, accessToken) {
  const siteId = await getSiteId(accessToken);

  await axios.delete(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  return { id };
}

// UPLOAD (Simple small file upload)
async function uploadItem(name, fileBuffer, targetFolderId, accessToken) {
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
}

// COPY
async function copyItem(id, targetFolderId, accessToken) {
  const siteId = await getSiteId(accessToken);

  // First fetch original item details
  const itemInfo = await axios.get(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const originalName = itemInfo.data.name;

  // Split name and extension
  const dotIndex = originalName.lastIndexOf(".");
  let newName;

  if (dotIndex > 0) {
    const base = originalName.substring(0, dotIndex);
    const ext = originalName.substring(dotIndex);
    newName = `${base}_copy${ext}`;
  } else {
    newName = `${originalName}_copy`;
  }

  // Perform copy
  await axios.post(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${id}/copy`,
    {
      parentReference: targetFolderId
        ? { id: targetFolderId }
        : undefined,
      name: newName
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );

  return {
    id,
    name: newName
  };
}

module.exports = {
  listItems,
  renameItem,
  moveItem,
  deleteItem,
  uploadItem,
  copyItem,
  getAllFolders
};
