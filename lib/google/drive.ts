import "server-only";
import { google, type drive_v3 } from "googleapis";

/**
 * Google Drive access via a service account.
 *
 * Required environment variables (see docs/setup-google-drive.md):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  service account email address
 *   GOOGLE_PRIVATE_KEY            the private key from the JSON key file
 *                                 (newlines may be escaped as \n)
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID   the shared folder that acts as the
 *                                 document repository root
 */

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  );
}

export function getDriveRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID not set");
  return id;
}

function getDriveClient(): drive_v3.Drive {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Google Drive is not configured. See docs/setup-google-drive.md",
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** List a folder's contents: folders first, then files, both alphabetical. */
export async function listFolder(folderId: string): Promise<DriveItem[]> {
  const drive = getDriveClient();
  const items: DriveItem[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime)",
      orderBy: "folder, name",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of res.data.files ?? []) {
      if (!file.id || !file.name) continue;
      items.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType ?? "application/octet-stream",
        isFolder: file.mimeType === FOLDER_MIME,
        size: file.size ? Number(file.size) : null,
        modifiedTime: file.modifiedTime ?? null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

/** Fetch one item's metadata (used for breadcrumbs and download headers). */
export async function getItem(fileId: string): Promise<
  DriveItem & { parents: string[] }
> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size, modifiedTime, parents",
    supportsAllDrives: true,
  });
  const file = res.data;
  return {
    id: file.id ?? fileId,
    name: file.name ?? "Untitled",
    mimeType: file.mimeType ?? "application/octet-stream",
    isFolder: file.mimeType === FOLDER_MIME,
    size: file.size ? Number(file.size) : null,
    modifiedTime: file.modifiedTime ?? null,
    parents: file.parents ?? [],
  };
}

/**
 * Confirm an item sits somewhere beneath the repository root.
 * Prevents crafted IDs reaching arbitrary Drive files the service
 * account can see.
 */
export async function isWithinRoot(fileId: string): Promise<boolean> {
  const root = getDriveRootFolderId();
  let current = fileId;
  for (let depth = 0; depth < 15; depth++) {
    if (current === root) return true;
    let item;
    try {
      item = await getItem(current);
    } catch {
      return false;
    }
    const parent = item.parents[0];
    if (!parent) return false;
    if (parent === root) return true;
    current = parent;
  }
  return false;
}

/** Download a binary file's content as a stream. */
export async function downloadFile(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );
  return res.data;
}

/** Export a Google-native doc (Docs/Sheets/Slides) as PDF. */
export async function exportAsPdf(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "stream" },
  );
  return res.data;
}

export function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}
