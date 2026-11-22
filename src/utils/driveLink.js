// Salinan Snapme_Desktop/src/utils/driveLink.js: ubah keduanya bersamaan.
// Link folder Google Drive.

/** ID folder dari link Drive ("…/folders/<id>" atau "…?id=<id>"), atau null bila tidak ditemukan. */
export function driveFolderIdOf(link) {
  const text = String(link || '').trim();
  return text.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] || text.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || null;
}
