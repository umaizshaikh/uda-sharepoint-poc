This is written so:

* Autodesk engineers can understand it
* Another developer can take over
* It clearly explains architecture, auth flow, and design decisions
* It looks professional

---

# 📄 README.md

```markdown
# UDA SharePoint Provider – PoC

## Overview

This project implements a **SharePoint Service Provider** compatible with Autodesk's L2FS-style filesystem abstraction.

The goal of this Proof of Concept (PoC) is to demonstrate:

- Federated document access
- SharePoint integration via Microsoft Graph
- Full CRUD filesystem operations
- Delegated OAuth2 authentication
- Clean provider abstraction (SPI-style architecture)

This implementation is structured so Autodesk engineers can extend or integrate it into L2FS with minimal refactoring.

---

# Architecture

## High-Level Flow

```

Express Routes
↓
FileService (Abstraction Layer)
↓
FileProvider Interface
↓
SharePointProvider
↓
sharepointAdapter (Microsoft Graph API)
↓
Microsoft Graph (SharePoint)

```

This mirrors the L2FS Service Provider Interface (SPI) pattern.

---

# Authentication Model

We use:

**OAuth2 Authorization Code Flow (Delegated Login)**

### Features:

- User signs in with Microsoft account
- Access token stored in session
- Refresh token stored in session
- Automatic token refresh implemented
- No manual re-login required after expiry

### Token Lifecycle

`TokenService.js` handles:

- Token validity check
- Automatic refresh using refresh_token
- Session updates
- Expiry timestamp management

---

# Microsoft Graph APIs Used

All SharePoint access is done through:

```

[https://graph.microsoft.com/v1.0/](https://graph.microsoft.com/v1.0/)

````

### Endpoints Used

| Operation | Endpoint |
|------------|----------|
| Get Site ID | `/sites/{domain}.sharepoint.com:/sites/{siteName}:` |
| List Root | `/sites/{siteId}/drive/root/children` |
| List Folder | `/sites/{siteId}/drive/items/{itemId}/children` |
| Rename | `PATCH /drive/items/{itemId}` |
| Move | `PATCH /drive/items/{itemId}` |
| Upload | `PUT /drive/root:/filename:/content` |
| Delete | `DELETE /drive/items/{itemId}` |
| Copy | `POST /drive/items/{itemId}/copy` |

> Note: Copy operation internally uses asynchronous Graph behavior.

---

# Filesystem Contract

All providers must return a normalized filesystem object:

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

This ensures UI is decoupled from provider implementation.

---

# Implemented Operations

| Operation       | Route                    |
| --------------- | ------------------------ |
| List Files      | `GET /files`             |
| Get All Folders | `GET /files/folders/all` |
| Rename          | `POST /files/rename`     |
| Move            | `POST /files/move`       |
| Upload          | `POST /files/upload`     |
| Copy            | `POST /files/copy`       |
| Delete          | `POST /files/delete`     |

---

# Setup Instructions

## 1. Clone Repository

```
git clone <repo>
cd uda-sharepoint-poc
```

## 2. Install Dependencies

```
npm install
```

## 3. Create `.env` File

```
TENANT_ID=
CLIENT_ID=
CLIENT_SECRET=
SESSION_SECRET=
```

## 4. Azure App Registration Requirements

### Redirect URI:

```
http://localhost:3000/auth/callback
```

### Required Delegated Permissions:

* Files.ReadWrite
* Sites.ReadWrite.All
* Sites.Read.All
* User.Read
* offline_access

Admin consent required.

---

# Running the Project

```
node server.js
```

Open:

```
http://localhost:3000/login
```

---

# Project Structure

```
/routes
    files.js

/services
    FileService.js
    TokenService.js
    sharepointAdapter.js

/providers
    FileProvider.js
    SharePointProvider.js

/public
    index.html

server.js
.env
```

---

# Key Design Decisions

## 1. Provider Abstraction

We implemented a provider interface so additional providers can be added:

* ACC Docs
* Fusion
* OneDrive
* Dropbox

Without changing route logic.

---

## 2. Delegated Auth (Not App-Only)

We intentionally used delegated login because:

* Matches UDA user login model
* Respects SharePoint ACLs
* Avoids global tenant access

---

## 3. Automatic Token Refresh

Token refresh is handled transparently in:

```
TokenService.getValidAccessToken()
```

Routes do not manage expiry logic.

---

## 4. Context-Based Provider Calls

All service calls use:

```
fileService.method(..., { accessToken })
```

This prevents future coupling to session storage.

---

# Known Limitations (PoC Scope)

* Copy operation does not poll async status (Graph 202)
* Large file upload (>4MB) not implemented (needs upload session)
* SiteId not cached (optimization possible)
* No webhook sync
* No permission mapping translation
* Session-based (not stateless)

---

# Future Production Enhancements

* Async copy polling
* SiteId caching
* Structured logging
* Standardized error contract
* Large file chunked upload
* Stateless token handling
* Multi-tenant support
* Webhook change notifications

---

# Why This Matches L2FS Goals

This PoC demonstrates:

* Unified filesystem abstraction
* Service Provider Interface design
* SharePoint federation feasibility
* Real-time file operations
* Clean extensible architecture

It is structured for easy integration into L2FS REST or GraphQL workflows.

---

# Conclusion

This project proves technical feasibility of integrating SharePoint into a unified filesystem abstraction layer similar to Autodesk L2FS.

The architecture is modular, secure, extensible, and ready for further hardening toward production.

```
- Or write a technical brief to send to Autodesk

You're now operating at integration-architecture level.
```
