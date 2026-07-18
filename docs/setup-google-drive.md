# Google Drive document repository setup

The portal's Documents section reads a Google Drive folder through a
service account. One-time setup, roughly 10 minutes.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com and sign in with the Google
   account that owns (or will own) the document folder.
2. Top bar → project dropdown → **New project**. Name it e.g.
   `doj-platform`. Create and select it.

## 2. Enable the Drive API

1. Left menu → **APIs & Services → Library**
2. Search **Google Drive API** → open it → **Enable**

## 3. Create the service account

1. **APIs & Services → Credentials → Create credentials → Service account**
2. Name: `doj-docs-reader`. Skip the optional role steps. **Done**.
3. Open the new service account → **Keys** tab → **Add key → Create new
   key → JSON** → download the file. Keep it private; treat it like a
   password.

## 4. Share the repository folder

1. In Google Drive, create (or pick) the folder that will hold portal
   documents, e.g. `DOJ Document Repository`.
2. Right-click → **Share** → paste the service account's email address
   (it looks like `doj-docs-reader@doj-platform.iam.gserviceaccount.com`,
   shown on the Credentials page) → role **Viewer** → Share.
3. Open the folder in the browser and copy the ID from the URL — the part
   after `/folders/`:
   `https://drive.google.com/drive/folders/THIS_LONG_ID_HERE`

## 5. Environment variables

Open the downloaded JSON key file. Add to `.env.local` (and later to your
hosting provider's environment settings):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=doj-docs-reader@doj-platform.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...rest of key...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID=THIS_LONG_ID_HERE
```

Notes:
- `client_email` in the JSON → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` in the JSON → `GOOGLE_PRIVATE_KEY`, kept inside double
  quotes, with the `\n` sequences left exactly as they are
- Never commit the JSON file or these values to git

## 6. Restart and test

Restart the dev server, sign in, open **Documents** in the portal sidebar.
Folder contents should appear. Uploading happens in Google Drive itself:
anything placed in the shared folder (by anyone you share it with) shows
up in the portal immediately.

## Behaviour

- Access requires the `documents.internal.view` permission.
- Downloads stream through the server, so the Drive folder itself can stay
  completely private — nothing is link-shared.
- Google-native files (Docs, Sheets, Slides) download as PDF exports.
- Downloads are audit logged with the acting user.

## Troubleshooting

- **"Could not reach Google Drive"** with a 403/404: the folder is not
  shared with the service account, or the Drive API is not enabled.
- **DECODER routines::unsupported** on startup: the private key lost its
  `\n` escapes — re-paste it inside double quotes exactly as in the JSON.
- Empty folder that should not be: confirm you copied the right folder ID.
