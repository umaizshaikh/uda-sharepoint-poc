function normalizeItem(spItem) {
  return {
    id: spItem.id,
    name: spItem.name,
    type: spItem.folder ? "folder" : "file",
    parentId: spItem.parentId || null,
    size: spItem.size || 0,
    modifiedAt: spItem.lastModifiedDateTime || null,
    source: "sharepoint"
  };
}

module.exports = { normalizeItem };
