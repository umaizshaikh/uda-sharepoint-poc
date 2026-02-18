/**
 * ProviderError - Standardized error format for all file providers
 * 
 * Ensures predictable error contracts across providers (SharePoint, L2FS, etc.)
 * 
 * Structure:
 * - code: Machine-readable error code (e.g., "AUTHENTICATION_FAILED", "ITEM_NOT_FOUND")
 * - message: Human-readable error message
 * - statusCode: HTTP status code (if applicable)
 * - details: Optional additional context (original error, Graph error details, etc.)
 */
class ProviderError extends Error {
  constructor(code, message, statusCode = null, details = null) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderError);
    }
  }

  /**
   * Convert to JSON-safe object for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        ...(this.details && { details: this.details })
      }
    };
  }
}

/**
 * Map Graph API error codes to ProviderError codes
 */
const GRAPH_ERROR_CODES = {
  400: "BAD_REQUEST",
  401: "AUTHENTICATION_FAILED",
  403: "PERMISSION_DENIED",
  404: "ITEM_NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "RATE_LIMIT_EXCEEDED",
  500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT"
};

/**
 * Wrap a Graph API error (axios error) into a ProviderError
 */
function wrapGraphError(err, operation = "unknown") {
  const status = err.response?.status || 500;
  const graphError = err.response?.data?.error;
  
  const code = GRAPH_ERROR_CODES[status] || "UNKNOWN_ERROR";
  const message = graphError?.message || err.message || "An unexpected error occurred";
  
  const details = {
    operation,
    provider: "SharePoint",
    ...(graphError && {
      graphCode: graphError.code,
      graphInnerError: graphError.innerError
    }),
    ...(err.response?.data && { rawResponse: err.response.data })
  };

  return new ProviderError(code, message, status, details);
}

/**
 * Wrap a generic error into a ProviderError
 */
function wrapError(err, operation = "unknown", code = "INTERNAL_ERROR") {
  if (err instanceof ProviderError) {
    return err;
  }
  
  const message = err.message || "An unexpected error occurred";
  const details = {
    operation,
    provider: "SharePoint",
    originalError: err.toString()
  };

  return new ProviderError(code, message, null, details);
}

module.exports = {
  ProviderError,
  wrapGraphError,
  wrapError,
  GRAPH_ERROR_CODES
};
