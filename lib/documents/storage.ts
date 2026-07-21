import "server-only";

export const DOCUMENTS_BUCKET = "documents";

/**
 * Storage paths are user-influenced, so they get strict validation:
 * segments of safe characters joined by single slashes, no dot-segments,
 * no hidden files, bounded length.
 */
export function isSafePath(path: string): boolean {
  if (path === "") return true; // bucket root
  if (path.length > 500) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,120}$/.test(segment) &&
      segment !== "." &&
      segment !== ".." &&
      !segment.startsWith("."),
  );
}

export function isSafeFileName(name: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,120}$/.test(name) &&
    !name.startsWith(".") &&
    name !== "." &&
    name !== ".."
  );
}

/** Placeholder object name used to make "folders" exist in flat storage. */
export const FOLDER_PLACEHOLDER = ".folder";

export function formatSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Resource links are stored as tiny JSON files with this extension. */
export const LINK_EXTENSION = ".link";

export function isSafeUrl(url: string): boolean {
  if (url.length > 2000) return false;
  return /^https?:\/\/[^\s]+$/i.test(url);
}
