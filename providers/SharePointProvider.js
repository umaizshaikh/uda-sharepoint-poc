const FileProvider = require("./FileProvider");
const sharepointAdapter = require("../services/sharepointAdapter");

class SharePointProvider extends FileProvider {
  async list(parentId, context) {
    return sharepointAdapter.listItems(parentId, context.accessToken);
  }

  async rename(id, newName, context) {
    return sharepointAdapter.renameItem(id, newName, context.accessToken);
  }

  async move(id, targetFolderId, context) {
    return sharepointAdapter.moveItem(id, targetFolderId, context.accessToken);
  }

  async upload(name, fileBuffer, targetFolderId, context) {
    return sharepointAdapter.uploadItem(
      name,
      fileBuffer,
      targetFolderId,
      context.accessToken
    );
  }

  async copy(id, targetFolderId, context) {
    return sharepointAdapter.copyItem(
      id,
      targetFolderId,
      context.accessToken
    );
  }

  async delete(id, context) {
    return sharepointAdapter.deleteItem(id, context.accessToken);
  }

  async getAllFolders(context) {
    return sharepointAdapter.getAllFolders(context.accessToken);
  }
}

module.exports = SharePointProvider;
