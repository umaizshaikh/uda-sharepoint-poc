/**
 * AuditService — Structured audit logging for user actions.
 * PoC-level: logs JSON lines to a file. Does not log tokens or raw provider responses.
 */

const fs = require("fs");
const path = require("path");

class AuditService {
  constructor() {
    // Root-level audit log file (PoC). One JSON object per line.
    this._logPath = path.join(__dirname, "..", "audit.log");
    this._stream = fs.createWriteStream(this._logPath, { flags: "a" });
    // If the stream errors, we silently drop audit logs (must not break app flow).
    this._stream.on("error", () => {});
  }

  /**
   * Log an audit event. Never throws; failures must not affect request flow.
   * @param {Object} event
   * @param {string} [event.userId] - User identifier
   * @param {string} event.action - e.g. 'COPY', 'MOVE', 'DELETE', 'UPLOAD', 'RENAME'
   * @param {string} event.provider - e.g. 'sharepoint'
   * @param {string|null} [event.resourceId]
   * @param {string|null} [event.resourceName]
   * @param {string|null} [event.operationId]
   * @param {string} event.status - 'success' | 'failed' | 'pending'
   * @param {string|null} [event.error]
   */
  log(event) {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        userId: event.userId ?? "unknown",
        action: event.action,
        provider: event.provider,
        resourceId: event.resourceId ?? null,
        resourceName: event.resourceName ?? null,
        operationId: event.operationId ?? null,
        status: event.status,
        error: event.error ?? null
      };
      this._stream.write(`${JSON.stringify(payload)}\n`);
    } catch (err) {
      // Audit must not break main execution (no console output).
    }
  }
}

module.exports = new AuditService();
