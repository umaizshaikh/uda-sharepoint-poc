const { normalizeItem } = require("../models/fileModel");
const {
  listItems,
  renameItem,
  moveItem,
  uploadItem,
  copyItem,
  deleteItem
} = require("./sharepointAdapter");

// LIST
async function list(parentId = null, accessToken) {
  const items = await listItems(parentId, accessToken);
  return items.map(normalizeItem);
}

async function getAllFolders(token) {
  const all = [];

  async function fetchRecursive(parentId = null, level = 0) {
    const items = await list(parentId, token);

    for (const item of items) {
      if (item.type === "folder") {
        all.push({
          id: item.id,
          name: item.name,
          level
        });

        await fetchRecursive(item.id, level + 1);
      }
    }
  }

  await fetchRecursive(null, 0);

  return all;
}

// RENAME
async function rename(id, newName, accessToken) {
  const updated = await renameItem(id, newName, accessToken);
  return normalizeItem(updated);
}

// MOVE
async function move(id, targetFolderId, accessToken) {
  const updated = await moveItem(id, targetFolderId, accessToken);
  return normalizeItem(updated);
}

// UPLOAD
async function upload(name, fileBuffer, targetFolderId, accessToken) {
  const created = await uploadItem(name, fileBuffer, targetFolderId, accessToken);
  return normalizeItem(created);
}

// COPY
async function copy(id, targetFolderId, accessToken) {
  const copied = await copyItem(id, targetFolderId, accessToken);
  return normalizeItem(copied);
}

// DELETE
async function remove(id, accessToken) {
  const deleted = await deleteItem(id, accessToken);
  return normalizeItem(deleted);
}

module.exports = { list, rename, move, upload, copy, remove, getAllFolders };