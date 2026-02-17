# 📄 README.md

```markdown
# UDA SharePoint Provider – Proof of Concept

## Overview

This repository contains a Proof of Concept (PoC) implementation of a **SharePoint Service Provider** compatible with Autodesk’s L2FS (Layer 2 File System) abstraction model.

The objective is to validate the technical feasibility of federating SharePoint storage into a unified filesystem interface similar to UDA/L2FS.

This PoC demonstrates:

- SharePoint integration via Microsoft Graph
- Delegated OAuth2 authentication (user context)
- Full CRUD filesystem operations
- SPI-style provider abstraction
- Clean separation of concerns

The architecture is intentionally structured for potential integration into L2FS with minimal refactoring.

---

## Architecture (High-Level)

```

Express Routes
↓
FileService
↓
FileProvider (Interface)
↓
SharePointProvider
↓
sharepointAdapter (Graph API Wrapper)
↓
Microsoft Graph API

````

- Routes are provider-agnostic
- Business logic depends on abstraction
- SharePoint-specific logic is isolated
- UI is decoupled from storage implementation

See `ARCHITECTURE.md` for detailed design documentation.

---

## Implemented Operations

| Operation | Route |
|------------|--------|
| List Files | `GET /files` |
| Get All Folders | `GET /files/folders/all` |
| Rename | `POST /files/rename` |
| Move | `POST /files/move` |
| Upload (small files) | `POST /files/upload` |
| Copy | `POST /files/copy` |
| Delete | `POST /files/delete` |

All responses return a normalized filesystem object independent of SharePoint-specific fields.

---

## Setup

### 1. Clone Repository

```bash
git clone <repo>
cd uda-sharepoint-poc
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env`:

```
TENANT_ID=
CLIENT_ID=
CLIENT_SECRET=
SESSION_SECRET=
```

---

## Azure App Registration

### Redirect URI

```
http://localhost:3000/auth/callback
```

### Required Delegated Permissions

* Files.ReadWrite
* Sites.ReadWrite.All
* Sites.Read.All
* User.Read
* offline_access

Admin consent required.

---

## Run Application

```bash
node server.js
```

Open:

```
http://localhost:3000/login
```

---

## Key Design Decisions

* **Delegated OAuth2 (User Context)**
  Ensures SharePoint ACL compliance and aligns with UDA user model.

* **Provider Abstraction (SPI Pattern)**
  Additional providers (OneDrive, Dropbox, ACC Docs, etc.) can be added without route changes.

* **Token Lifecycle Centralization**
  Automatic refresh handled by `TokenService`.

* **Storage Decoupling**
  UI and routes do not depend on SharePoint-specific structures.

---

## Known PoC Limitations

* Async copy polling not implemented
* Large file chunked upload not implemented
* SiteId caching not implemented
* No webhook-based synchronization
* Session-based (not stateless)
* No structured logging or standardized error contract

---

## Production Hardening (Next Steps)

* Async operation tracking for copy
* SiteId caching layer
* Chunked upload support
* Structured logging
* Error contract standardization
* Stateless token management
* Multi-tenant support

---

## Conclusion

This PoC validates the feasibility of integrating SharePoint into an L2FS-style unified filesystem abstraction using a modular, extensible provider architecture.

For detailed technical design, see `ARCHITECTURE.md`.

````
