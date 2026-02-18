const FileProvider = require("./FileProvider");
const sharepointAdapter = require("../services/sharepointAdapter");
const OperationManager = require("../services/OperationManager");
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

    // Create operation in OperationManager
    const operation = OperationManager.create({
      type: "copy",
      provider: "SharePoint",
      metadata: {
        sourceId: id,
        targetFolderId,
        newName,
        adapterOperationId: adapterOpId
      }
    });

    // Start non-blocking polling (don't await)
    this.startCopyPolling(operation.id, monitorUrl, context.accessToken);

    // Return immediately with pending status
    return {
      operationId: operation.id,
      status: "pending"
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
          OperationManager.update(operationId, {
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
          OperationManager.update(operationId, {
            status: "completed",
            result: {
              message: "Copy completed successfully",
              resourceId: responseData.resourceId,
              ...responseData
            }
          });
          return;
        }

        // Handle failed status
        if (responseData.status === "failed") {
          OperationManager.update(operationId, {
            status: "failed",
            error: responseData.error?.message || "Copy operation failed"
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
          OperationManager.update(operationId, {
            status: "completed",
            result: {
              message: "Copy completed successfully",
              resourceId,
              ...responseData
            }
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
        OperationManager.update(operationId, {
          status: "failed",
          error: `Unexpected response status: ${response.status}`
        });
      } catch (err) {
        // Axios error - mark as failed
        OperationManager.update(operationId, {
          status: "failed",
          error: err.message || "Polling error occurred"
        });
      }
    };

    // Start polling immediately (non-blocking)
    poll().catch(err => {
      // Final catch for any unexpected errors
      OperationManager.update(operationId, {
        status: "failed",
        error: err.message || "Unexpected polling error"
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
