class FileService {
  constructor(provider) {
    this.provider = provider;
  }

  list(parentId, context) {
    return this.provider.list(parentId, context);
  }

  rename(id, newName, context) {
    return this.provider.rename(id, newName, context);
  }

  move(id, targetFolderId, context) {
    return this.provider.move(id, targetFolderId, context);
  }

  upload(name, buffer, targetFolderId, context) {
    return this.provider.upload(name, buffer, targetFolderId, context);
  }

  copy(id, targetFolderId, context) {
    return this.provider.copy(id, targetFolderId, context);
  }

  startCopy(id, targetFolderId, context) {
    return this.provider.startCopy(id, targetFolderId, context);
  }

  getCopyStatus(operationId) {
    return this.provider.getCopyStatus(operationId);
  }

  delete(id, context) {
    return this.provider.delete(id, context);
  }

  getAllFolders(context) {
    return this.provider.getAllFolders(context);
  }
}

module.exports = FileService;
