// Salinan Snapme_Desktop/src/utils/phone.js: ubah keduanya bersamaan.
// Nomor telepon. Booking menyimpan nomor format lokal "08…"; ID WhatsApp ("…@c.us", "…@lid") dibiarkan apa adanya.

/** "+62 812-3456" / "62812…" / "812…" → "0812…". String yang berisi "@" (ID WhatsApp) tidak diubah. */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  if (phone.includes('@')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  if (digits && !digits.startsWith('0')) return '0' + digits;
  return digits;
};
