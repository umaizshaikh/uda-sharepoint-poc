# UDA SharePoint Provider – Proof of Concept

## Overview

This repository contains a Proof of Concept (PoC) implementation of a SharePoint service provider using Microsoft Graph and a provider-style filesystem abstraction. It supports delegated Microsoft sign-in and file operations such as listing, moving, renaming, uploading, copying, and deleting.

## Setup

1. Install Node.js 18 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set the values for your Microsoft app registration.
4. Run `node server.js`, then open `http://localhost:3000/login`.

Required configuration:

| Variable | Purpose |
| --- | --- |
| `TENANT_ID` | Microsoft Entra tenant used for OAuth |
| `CLIENT_ID` | App registration client ID |
| `CLIENT_SECRET` | App registration secret (keep private; do not commit `.env`) |
| `SESSION_SECRET` | Random session-signing secret; keep stable between restarts |

Generate a `SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. If omitted, the app generates a temporary random value so local development still starts; users will need to sign in again after each restart. Set a persistent secret in deployment environments.

Register `http://localhost:3000/auth/callback` as a redirect URI and grant the delegated Graph permissions required by your deployment.

## Security notes

- Never commit `.env` or real credentials. The included `.env.example` contains placeholders only.
- Session cookies are HTTP-only, SameSite=Lax, time-limited, and marked Secure in production.
- OAuth sign-in uses a per-request state value, and the session ID is regenerated after successful authentication.
- File and operation endpoints require a signed-in session. Copy-operation status is restricted to the user who started it.
- The previously hardcoded session-signing value is no longer used. Because it was in public Git history, existing deployments should set a new `SESSION_SECRET` and restart to invalidate sessions signed with the old value.
- The SharePoint tenant domain and site path in `services/sharepointAdapter.js` identify the target site, but are not authentication credentials; access still depends on Microsoft authorization. Configure your own target when adapting this PoC.

## Implemented operations

| Operation | Route |
| --- | --- |
| List files | `GET /files` |
| List folders | `GET /files/folders/all` |
| Rename | `POST /files/rename` |
| Move | `POST /files/move` |
| Upload | `POST /files/upload` |
| Copy | `POST /files/copy` |
| Delete | `POST /files/delete` |
| Copy status | `GET /operations/:id` |

## Architecture

Express routes delegate to `FileService`, which uses the `SharePointProvider` and `services/sharepointAdapter.js` for Microsoft Graph operations. `OperationManager` tracks asynchronous copy status in memory. This is a proof of concept; production use should configure a durable session store, HTTPS/reverse-proxy settings, and operational monitoring.
