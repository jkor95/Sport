# Sport-app: Dell self-hosting preparation

This branch is isolated from `main`. Do not merge or change the live GitHub Pages deployment until full functional and data migration tests pass.

## Verified repository architecture
- Frontend is a static HTML/JS PWA.
- `config.js` points at `https://gcxnxfwmgcrhfgjlqbnn.supabase.co`.
- `local-auth.js` calls `/functions/v1/mijnloop-sync` for login, account administration, load/save and migration.
- `db.js` uses that remote sync API.
- `supabase/functions/` contains other functions for notifications, calendar and Strava.
- The `mijnloop-sync` backend implementation is **not present in the inspected repository tree**. We must locate/export it before attempting a faithful self-hosted replacement.
- The original login design supports user/admin roles; ensure migration preserves permissions and data, not just the UI.

## Deployment trial
Dockerfile serves the unchanged static UI with Nginx. In Coolify select this branch, Dockerfile build pack and internal port 80; avoid public domain until secure external access is ready.
**This is a frontend-only trial and still relies on Supabase Cloud; it is NOT an offline-independent version.**

## Required before cutover
1. Obtain existing edge function source and database schema, user records, data and authorization policies. Never commit secrets or personal data.
2. Design a private server API: server-side PostgreSQL credentials, password hashing, secure session management, account roles, admin access, CSRF/CORS/rate limiting, session migration.
3. Implement API equivalents for `status`, `login`, `logout`, `bootstrap`, `load`, `save`, `admin-*`, password changes and any other actions.
4. Migrate existing data with a reversible, tested process; validate revision/conflict behavior and all relevant app screens.
5. Replace browser Supabase URL and publishable key with an API base URL, update notification, calendar and other integrations.
6. Add consistent PostgreSQL and file backups for the new app to Restic and perform a restore drill. A 32GB microSD is temporary only.
7. Set up HTTPS, an appropriate public DNS address and restricted service/admin ports before any external rollout.
8. Cut over only after side-by-side tests and a rollback plan.

## Current state
Only separate branch, Dockerfile, and preparation notes created. The live `main` remains unchanged.

## 2026-10-31: source recovered from owner
Downloaded `mijnloop-sync.zip` has been inspected locally. The single `index.ts` file defines these API actions:
`status`, `migrate-local`, `bootstrap`, `login`, `admin-login`, `logout`, `load`, `save`, `change-password`, `admin-list`, `admin-state`, `admin-create`, `admin-update`, `admin-password`, `admin-delete`.

Tables used: `mijnloop_accounts`, `mijnloop_sessions`, `mijnloop_states`.
Current sessions are SHA-256 token hashes with expiration. Current passwords are stored as plaintext (`password_plain`) and compared directly. **Security-critical migration**: replace plaintext passwords with Argon2id/scrypt hashes; do not copy the old password exposure behavior into the replacement admin API. Migrate users safely and make existing sessions reauthenticate. Preserve saved sport data and revision-based conflict protection. Existing CORS origin is hardcoded to GitHub Pages and must be adapted for new own-domain HTTPS.

The downloaded source is **not committed to this public repository** because it contains security-sensitive implementation details and should be reviewed/reworked first. No existing database or live function has been altered.
