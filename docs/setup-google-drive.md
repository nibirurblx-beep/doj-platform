# Google Drive service account setup (Phase 1H — placeholder)

Not needed yet. When Phase 1H begins this document will walk through:

1. Creating a Google Cloud project (your account) and enabling the Drive API.
2. Creating a service account with no roles and downloading its JSON key.
3. Base64-encoding the key into GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
   (server-only environment variable, never committed).
4. Sharing only the intended Drive folders with the service-account email
   as Viewer (least privilege).
5. Registering those folders as drive_sources in the admin panel.
