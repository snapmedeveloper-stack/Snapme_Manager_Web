// Salinan Snapme_Desktop/src/constants/roles.js: ubah keduanya bersamaan.
// Role pengguna di organisasi (field users/{uid}.role) dan tampilannya (docs/STANDAR_UI.md §5).

export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', operator: 'Operator' };

// Role dibedakan lewat teks; hanya owner yang memakai warna aksen
export const ROLE_TONE = { owner: 'accent', manager: 'neutral', operator: 'neutral' };

/** Owner & manager boleh mengelola karyawan dan layanan. */
export const canManageStaff = (role) => role === 'owner' || role === 'manager';
