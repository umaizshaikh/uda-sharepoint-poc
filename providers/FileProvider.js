/**
 * FileProvider Interface
 * All providers (SharePoint, ACC, Fusion, etc.)
 * must implement these methods.
 */
class FileProvider {
  async list(parentId, context) {
    throw new Error("Not implemented");
  }

  async rename(id, newName, context) {
    throw new Error("Not implemented");
  }

  async move(id, targetFolderId, context) {
    throw new Error("Not implemented");
  }

  async upload(name, fileBuffer, targetFolderId, context) {
    throw new Error("Not implemented");
  }

  async copy(id, targetFolderId, context) {
    throw new Error("Not implemented");
  }

  async delete(id, context) {
    throw new Error("Not implemented");
  }

  async getAllFolders(context) {
    throw new Error("Not implemented");
  }
}

module.exports = FileProvider;
