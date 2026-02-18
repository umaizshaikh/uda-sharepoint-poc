const AuditService = require("./AuditService");

class FileService {
  constructor(provider) {
    this.provider = provider;
  }

  _userId(context) {
    return context?.userId ?? "unknown";
  }

  list(parentId, context) {
    return this.provider.list(parentId, context);
  }

  async rename(id, newName, context) {
    const userId = this._userId(context);
    try {
      const result = await this.provider.rename(id, newName, context);
      AuditService.log({
        userId,
        action: "RENAME",
        provider: "sharepoint",
        resourceId: id,
        resourceName: newName,
        operationId: null,
        status: "success",
        error: null
      });
      return result;
    } catch (err) {
      AuditService.log({
        userId,
        action: "RENAME",
        provider: "sharepoint",
        resourceId: id,
        resourceName: newName,
        operationId: null,
        status: "failed",
        error: err.message ?? String(err)
      });
      throw err;
    }
  }

  async move(id, targetFolderId, context) {
    const userId = this._userId(context);
    try {
      const result = await this.provider.move(id, targetFolderId, context);
      AuditService.log({
        userId,
        action: "MOVE",
        provider: "sharepoint",
        resourceId: id,
        resourceName: null,
        operationId: null,
        status: "success",
        error: null
      });
      return result;
    } catch (err) {
      AuditService.log({
        userId,
        action: "MOVE",
        provider: "sharepoint",
        resourceId: id,
        resourceName: null,
        operationId: null,
        status: "failed",
        error: err.message ?? String(err)
      });
      throw err;
    }
  }

  async upload(name, buffer, targetFolderId, context) {
    const userId = this._userId(context);
    try {
      const result = await this.provider.upload(name, buffer, targetFolderId, context);
      AuditService.log({
        userId,
        action: "UPLOAD",
        provider: "sharepoint",
        resourceId: result?.id ?? null,
        resourceName: name,
        operationId: null,
        status: "success",
        error: null
      });
      return result;
    } catch (err) {
      AuditService.log({
        userId,
        action: "UPLOAD",
        provider: "sharepoint",
        resourceId: null,
        resourceName: name,
        operationId: null,
        status: "failed",
        error: err.message ?? String(err)
      });
      throw err;
    }
  }

  async copy(id, targetFolderId, context) {
    const userId = this._userId(context);
    try {
      const result = await this.provider.copy(id, targetFolderId, context);
      // Async copy: completion logged in provider polling (success/failed).
      return result;
    } catch (err) {
      AuditService.log({
        userId,
        action: "COPY",
        provider: "sharepoint",
        resourceId: id,
        resourceName: null,
        operationId: null,
        status: "failed",
        error: err.message ?? String(err)
      });
      throw err;
    }
  }

  startCopy(id, targetFolderId, context) {
    return this.provider.startCopy(id, targetFolderId, context);
  }

  getCopyStatus(operationId) {
    return this.provider.getCopyStatus(operationId);
  }

  async delete(id, context) {
    const userId = this._userId(context);
    try {
      const result = await this.provider.delete(id, context);
      AuditService.log({
        userId,
        action: "DELETE",
        provider: "sharepoint",
        resourceId: id,
        resourceName: null,
        operationId: null,
        status: "success",
        error: null
      });
      return result;
    } catch (err) {
      AuditService.log({
        userId,
        action: "DELETE",
        provider: "sharepoint",
        resourceId: id,
        resourceName: null,
        operationId: null,
        status: "failed",
        error: err.message ?? String(err)
      });
      throw err;
    }
  }

  getAllFolders(context) {
    return this.provider.getAllFolders(context);
  }
}

module.exports = FileService;
