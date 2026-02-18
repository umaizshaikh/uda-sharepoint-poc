const FileProvider = require("./FileProvider");
const sharepointAdapter = require("../services/sharepointAdapter");
const OperationManager = require("../services/OperationManager");
const AuditService = require("../services/AuditService");
const axios = require("axios");

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
    // Initiate copy with Graph API (returns 202 + monitor URL)
    const { operationId: adapterOpId, newName, monitorUrl } = await sharepointAdapter.startCopy(
      id,
      targetFolderId,
      context.accessToken
    );

    // Create operation in OperationManager (userId for audit on completion)
    const userId = context?.userId ?? "unknown";
    const operation = OperationManager.create({
      type: "copy",
      provider: "SharePoint",
      metadata: {
        sourceId: id,
        targetFolderId,
        newName,
        adapterOperationId: adapterOpId,
        userId
      }
    });

    // Start non-blocking polling (don't await)
    this.startCopyPolling(operation.id, monitorUrl, context.accessToken);

    // Return immediately with pending status
    return {
      operationId: operation.id,
      status: "pending",
      newName
    };
  }

  /**
   * Non-blocking polling of Graph monitor URL
   * Updates operation status as copy progresses
   */
  startCopyPolling(operationId, monitorUrl, accessToken) {
    const MAX_DURATION = 60000; // 60 seconds
    const POLL_INTERVAL = 2000; // 2 seconds
    const startTime = Date.now();

    // Immediately update status to running
    OperationManager.update(operationId, { status: "running" });

    // Start polling loop (non-blocking)
    const poll = async () => {
      try {
        // Check timeout before polling
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION) {
          const op = OperationManager.get(operationId);
          const meta = op?.metadata ?? {};
          OperationManager.update(operationId, {
            status: "failed",
            error: "Operation timeout"
          });
          AuditService.log({
            userId: meta.userId ?? "unknown",
            action: "COPY",
            provider: "sharepoint",
            resourceId: meta.sourceId ?? null,
            resourceName: meta.newName ?? null,
            operationId,
            status: "failed",
            error: "Operation timeout"
          });
          return;
        }

        // Poll monitor URL (no auth required)
        const response = await axios.get(monitorUrl, {
          validateStatus: () => true,
          maxRedirects: 0
        });

        const responseData = response.data || {};

        // Handle completed status
        if (responseData.status === "completed") {
          const op = OperationManager.get(operationId);
          const meta = op?.metadata ?? {};
          OperationManager.update(operationId, {
            status: "completed",
            result: {
              message: "Copy completed successfully",
              resourceId: responseData.resourceId,
              ...responseData
            }
          });
          AuditService.log({
            userId: meta.userId ?? "unknown",
            action: "COPY",
            provider: "sharepoint",
            resourceId: responseData.resourceId ?? meta.sourceId ?? null,
            resourceName: meta.newName ?? null,
            operationId,
            status: "success",
            error: null
          });
          return;
        }

        // Handle failed status
        if (responseData.status === "failed") {
          const errMsg = responseData.error?.message || "Copy operation failed";
          const op = OperationManager.get(operationId);
          const meta = op?.metadata ?? {};
          OperationManager.update(operationId, {
            status: "failed",
            error: errMsg
          });
          AuditService.log({
            userId: meta.userId ?? "unknown",
            action: "COPY",
            provider: "sharepoint",
            resourceId: meta.sourceId ?? null,
            resourceName: meta.newName ?? null,
            operationId,
            status: "failed",
            error: errMsg
          });
          return;
        }

        // Handle HTTP 303 (redirect to completed resource)
        if (response.status === 303 || response.status === 200) {
          let resourceId = responseData.resourceId;
          if (!resourceId && response.headers?.location) {
            const m = response.headers.location.match(/\/items\/([^/?]+)/);
            if (m) resourceId = m[1];
          }
          const op = OperationManager.get(operationId);
          const meta = op?.metadata ?? {};
          OperationManager.update(operationId, {
            status: "completed",
            result: {
              message: "Copy completed successfully",
              resourceId,
              ...responseData
            }
          });
          AuditService.log({
            userId: meta.userId ?? "unknown",
            action: "COPY",
            provider: "sharepoint",
            resourceId: resourceId ?? meta.sourceId ?? null,
            resourceName: meta.newName ?? null,
            operationId,
            status: "success",
            error: null
          });
          return;
        }

        // Still in progress (202) - continue polling
        if (response.status === 202) {
          // Update progress if available
          if (responseData.percentageComplete !== undefined) {
            OperationManager.update(operationId, {
              metadata: {
                ...OperationManager.get(operationId)?.metadata,
                percentageComplete: responseData.percentageComplete
              }
            });
          }
          // Schedule next poll
          setTimeout(poll, POLL_INTERVAL);
          return;
        }

        // Unexpected status - mark as failed
        const errMsg = `Unexpected response status: ${response.status}`;
        const opU = OperationManager.get(operationId);
        const metaU = opU?.metadata ?? {};
        OperationManager.update(operationId, {
          status: "failed",
          error: errMsg
        });
        AuditService.log({
          userId: metaU.userId ?? "unknown",
          action: "COPY",
          provider: "sharepoint",
          resourceId: metaU.sourceId ?? null,
          resourceName: metaU.newName ?? null,
          operationId,
          status: "failed",
          error: errMsg
        });
      } catch (err) {
        // Axios error - mark as failed
        const errMsg = err.message || "Polling error occurred";
        const opE = OperationManager.get(operationId);
        const metaE = opE?.metadata ?? {};
        OperationManager.update(operationId, {
          status: "failed",
          error: errMsg
        });
        AuditService.log({
          userId: metaE.userId ?? "unknown",
          action: "COPY",
          provider: "sharepoint",
          resourceId: metaE.sourceId ?? null,
          resourceName: metaE.newName ?? null,
          operationId,
          status: "failed",
          error: errMsg
        });
      }
    };

    // Start polling immediately (non-blocking)
    poll().catch(err => {
      // Final catch for any unexpected errors
      const errMsg = err.message || "Unexpected polling error";
      const opC = OperationManager.get(operationId);
      const metaC = opC?.metadata ?? {};
      OperationManager.update(operationId, {
        status: "failed",
        error: errMsg
      });
      AuditService.log({
        userId: metaC.userId ?? "unknown",
        action: "COPY",
        provider: "sharepoint",
        resourceId: metaC.sourceId ?? null,
        resourceName: metaC.newName ?? null,
        operationId,
        status: "failed",
        error: errMsg
      });
    });
  }

  async startCopy(id, targetFolderId, context) {
    return sharepointAdapter.startCopy(
      id,
      targetFolderId,
      context.accessToken
    );
  }

  async getCopyStatus(operationId) {
    return sharepointAdapter.getCopyStatus(operationId);
  }

  async delete(id, context) {
    return sharepointAdapter.deleteItem(id, context.accessToken);
  }

  async getAllFolders(context) {
    return sharepointAdapter.getAllFolders(context.accessToken);
  }
}

module.exports = SharePointProvider;
