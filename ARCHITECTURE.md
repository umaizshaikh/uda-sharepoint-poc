# 📄 ARCHITECTURE.md

```markdown
# UDA SharePoint Provider – Architecture Documentation

## 1. Purpose

This document describes the architectural decisions, authentication flow, provider abstraction, and integration approach used in the SharePoint Provider PoC.

The design aligns with Autodesk’s L2FS Service Provider Interface (SPI) model.

---

# 2. Architectural Principles

The implementation follows these principles:

1. Separation of concerns
2. Provider abstraction (SPI pattern)
3. Authentication isolation
4. Storage decoupling
5. Extensibility for additional providers
6. Minimal coupling to session or framework

---

# 3. Layered Architecture

## 3.1 Request Flow

````

Client (UI)
↓
Express Route Layer
↓
FileService (Application Layer)
↓
FileProvider Interface (SPI Contract)
↓
SharePointProvider (Concrete Implementation)
↓
sharepointAdapter (Graph Wrapper)
↓
Microsoft Graph API

```

---

## 3.2 Layer Responsibilities

### Express Routes
- Handle HTTP input/output
- Perform minimal validation
- Delegate to FileService
- No storage-specific logic

---

### FileService (Application Layer)
- Orchestrates provider calls
- Passes contextual accessToken
- Maintains provider-agnostic contract

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
- Normalizes output format

---

### sharepointAdapter
- Encapsulates raw Microsoft Graph calls
- Handles endpoint construction
- Isolates external API dependency

---

# 4. Authentication Architecture

## 4.1 OAuth2 Authorization Code Flow (Delegated)

The PoC uses delegated user authentication.

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

All service calls request tokens via:

```

TokenService.getValidAccessToken()

````

---

# 5. Filesystem Abstraction Contract

Providers must return normalized objects:

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

---

# 6. Microsoft Graph Integration

Base endpoint:

```
https://graph.microsoft.com/v1.0/
```

Operations implemented:

* Site resolution
* Folder listing
* File listing
* Rename (PATCH)
* Move (PATCH)
* Upload (PUT small files)
* Delete (DELETE)
* Copy (POST async)

---

## 6.1 Copy Operation

Graph copy returns HTTP 202 with monitor URL.

Current PoC:

* Initiates copy
* Does not poll for completion

Production enhancement:

* Implement polling or background operation tracking

---

# 7. Design Decisions & Rationale

## 7.1 Delegated vs App-Only Auth

Delegated chosen to:

* Respect SharePoint ACL boundaries
* Align with UDA user context
* Avoid broad tenant access

---

## 7.2 Provider Isolation

SharePoint logic does not exist in:

* Routes
* UI
* FileService

This enables future providers without refactoring application layers.

---

## 7.3 Context-Based Access

Service calls use:

```
fileService.method(params, { accessToken })
```

Prevents tight coupling to session state and supports future stateless refactor.

---

# 8. Limitations (PoC Scope)

Not implemented:

* Large file upload session
* SiteId caching
* Multi-tenant isolation
* Permission mapping between Autodesk and SharePoint
* Webhook change notifications
* Structured logging
* Standardized error contract
* Correlation IDs

---

# 9. Path to Production

To move toward production readiness:

1. Async copy polling or background job handling
2. SiteId caching with TTL
3. Chunked upload support
4. Structured logging (Winston/Pino)
5. Standard error contract
6. Stateless token storage (JWT/secure store)
7. Webhook subscription for change events
8. Multi-tenant configuration isolation
9. Permission translation abstraction layer

---

# 10. Alignment with L2FS SPI Model

This implementation demonstrates:

* Clean service provider extensibility
* Storage federation feasibility
* User-context authentication
* Decoupled filesystem abstraction
* Minimal dependency on L2FS internal codebase

The architecture is compatible with future:

* REST aggregation
* GraphQL exposure
* APS publication

---

# 11. Conclusion

This PoC validates the feasibility of integrating SharePoint into a unified filesystem abstraction aligned with Autodesk’s L2FS SPI architecture.

The implementation emphasizes modularity, extensibility, and architectural clarity, while intentionally limiting scope to feasibility validation.

```
