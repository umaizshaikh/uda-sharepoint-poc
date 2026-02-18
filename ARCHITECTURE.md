# 📄 ARCHITECTURE.md (Updated)

````markdown
# UDA SharePoint Provider – Architecture Documentation

## 1. Purpose

This document describes the architectural decisions, authentication flow, provider abstraction, async operation handling, audit logging, and integration strategy used in the SharePoint Provider implementation.

The design aligns with Autodesk’s L2FS Service Provider Interface (SPI) model and has evolved beyond initial feasibility validation into an integration-ready backend prototype.

---

# 2. Architectural Principles

The implementation follows these principles:

1. Separation of concerns
2. Provider abstraction (SPI pattern)
3. Authentication isolation
4. Storage decoupling
5. Async operation safety (non-blocking design)
6. Standardized error contract
7. Audit accountability
8. Extensibility for additional providers
9. Minimal coupling to framework/session

---

# 3. Layered Architecture

## 3.1 Request Flow

Client (UI)  
→ Express Route Layer  
→ FileService (Application Layer)  
→ FileProvider Interface (SPI Contract)  
→ SharePointProvider (Concrete Implementation)  
→ sharepointAdapter (Graph Wrapper)  
→ Microsoft Graph API  

---

## 3.2 Extended Async Flow (Copy Example)

Client  
→ POST /files/copy  
→ OperationManager.create()  
→ Immediate response { operationId }  
→ Background polling via startCopyPolling()  
→ Operation status updates  
→ GET /operations/:id  

This ensures non-blocking behavior and scalable async handling.

---

## 3.3 Layer Responsibilities

### Express Routes
- Handle HTTP I/O
- Perform minimal validation
- Delegate to FileService
- No storage or Graph logic

---

### FileService (Application Layer)
- Orchestrates provider calls
- Passes contextual accessToken
- Logs audit events
- Maintains provider-agnostic contract
- Does not contain SharePoint-specific logic

---

### FileProvider Interface
Defines required methods:

- listFiles
- rename
- move
- upload
- copy
- delete

Ensures interchangeable provider implementations.

---

### SharePointProvider
- Implements FileProvider interface
- Translates provider contract into Graph operations
- Handles async copy polling
- Updates OperationManager lifecycle
- Emits audit logs on async completion/failure
- Normalizes output format

---

### sharepointAdapter
- Encapsulates raw Microsoft Graph calls
- Handles endpoint construction
- Performs SiteId resolution (with caching)
- Isolates external API dependency

---

### OperationManager
- In-memory async operation tracking
- Stores lifecycle state:
  - pending
  - running
  - completed
  - failed
- Supports TTL cleanup
- Provider-agnostic
- Enables non-blocking async behavior

---

### AuditService
- Structured audit logging
- Logs:
  - userId
  - action
  - provider
  - resourceId
  - operationId
  - status
  - error (if any)
- Does not log tokens or sensitive data
- Does not affect request flow
- Designed for future persistence extension

---

# 4. Authentication Architecture

## 4.1 OAuth2 Authorization Code Flow (Delegated)

The implementation uses delegated user authentication.

Flow:

1. User logs in via Microsoft identity
2. Authorization code exchanged for:
   - access_token
   - refresh_token
3. Tokens stored in session
4. Expiry tracked
5. TokenService refreshes automatically when expired

---

## 4.2 TokenService Responsibilities

- Validate expiry timestamp
- Refresh token using refresh_token
- Update session
- Prevent route-level token handling
- Ensure uninterrupted user experience

All service calls retrieve tokens via:

TokenService.getValidAccessToken()

---

# 5. Filesystem Abstraction Contract

Providers return normalized filesystem objects:

```json
{
  "id": "string",
  "name": "string",
  "type": "file | folder",
  "parentId": "string | null",
  "size": "number",
  "lastModifiedDateTime": "ISO string"
}
````

This ensures:

* UI independence from SharePoint schema
* Compatibility with L2FS-style aggregation
* Provider interchangeability
* No leakage of Graph-specific fields

---

# 6. Microsoft Graph Integration

Base endpoint:

[https://graph.microsoft.com/v1.0/](https://graph.microsoft.com/v1.0/)

Operations implemented:

* Site resolution (with in-memory caching)
* Folder listing
* File listing
* Rename (PATCH)
* Move (PATCH)
* Upload (small files via PUT)
* Delete (DELETE)
* Copy (POST async with background polling)

---

## 6.1 Copy Operation (Async Handling)

Graph copy returns HTTP 202 with monitor URL.

Current Implementation:

* Creates operation via OperationManager
* Returns immediately with operationId
* Polls monitor URL in background
* Updates operation lifecycle
* Applies timeout guard (60 seconds)
* Logs audit event on completion/failure

This ensures scalable, non-blocking behavior.

---

# 7. Error Handling Strategy

A standardized error contract is enforced across routes:

{
"code": "ERROR_CODE",
"message": "Human readable message"
}

This prevents raw Graph errors from leaking to clients and maintains consistent API behavior.

---

# 8. SiteId Caching

To reduce redundant Graph calls:

* SiteId resolution is cached in memory
* Reduces latency
* Reduces rate-limit risk
* Designed for future TTL or Redis extension

---

# 9. Audit Logging Strategy

Audit logging captures:

* Who performed action
* What action was performed
* On which resource
* Provider
* OperationId (if async)
* Status
* Timestamp

Audit logging is:

* Structured JSON
* Non-blocking
* Separated from business logic
* Designed for future persistence

Sensitive data (tokens, secrets) are never logged.

---

# 10. Current Limitations

Not implemented:

* Large file chunked upload (>4MB upload session)
* Multi-tenant isolation
* Permission mapping between Autodesk and SharePoint
* Webhook-based change notifications
* Structured operational logging (Winston/Pino)
* Correlation IDs
* Persistent operation storage (Redis/DB)

---

# 11. Path to Production

To move toward enterprise-grade readiness:

1. Large file upload session support
2. Redis-backed OperationManager
3. Persistent audit storage
4. Structured operational logging
5. Correlation ID middleware
6. Webhook change notifications
7. Multi-tenant isolation model
8. Permission translation abstraction layer

---

# 12. Alignment with L2FS SPI Model

This implementation now demonstrates:

* Clean service provider extensibility
* Storage federation feasibility
* Delegated user authentication
* Async lifecycle handling
* Audit accountability
* Standardized error contract
* Decoupled filesystem abstraction
* Minimal dependency on L2FS internal codebase

The architecture remains compatible with future:

* REST aggregation
* GraphQL exposure
* APS publication
* Additional external providers

---

# 13. Conclusion

The SharePoint Provider has evolved from a basic feasibility PoC into a structured, integration-ready backend component.

It now includes:

* Provider abstraction
* Delegated authentication
* Async operation tracking
* SiteId caching
* Standardized error contract
* Audit logging
* Non-blocking lifecycle management

The architecture emphasizes modularity, extensibility, operational safety, and enterprise alignment, while intentionally deferring advanced synchronization and multi-tenant features to future iterations.

```
