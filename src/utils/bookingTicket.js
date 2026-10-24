// Tiket booking untuk dikirim ke customer lewat WhatsApp. Formatnya HARUS sama dengan tiket bot #tiket di
// Snapme_Desktop/src/commandCenter.js (ticketStr2): gateway WA Desktop mengenali tiket dari baris "TIKET BOKINGAN",
// "Nama:" dan "Tanggal:" (DD/MM/YYYY), lalu menautkan nomor customer ke booking dengan nama & tanggal yang sama
// persis. Ubah keduanya bersamaan.

/** Teks tiket booking, mis. "🎟️ *TIKET BOKINGAN*\nNama: Dian\nTanggal: 24/10/2026\nWaktu: 10:00\n…". */
export function buildBookingTicket(booking) {
  const [y, m, d] = (booking.date || '').split('-');
  const waktu = `${String(booking.startHour).padStart(2, '0')}:${String(booking.startMin || 0).padStart(2, '0')}`;
  const tambahan = Object.values(booking.addOns || {})
    .filter((ao) => ao.qty > 0)
    .map((ao) => `${ao.qty}x ${ao.name}`);
  // ui-exception: emoji adalah isi pesan WhatsApp (sama dengan tiket Desktop), bukan ikon UI
  return `🎟️ *TIKET BOKINGAN*\nNama: ${booking.customerName}\nTanggal: ${d}/${m}/${y}\nWaktu: ${waktu}\nPaket: ${booking.package || '-'}\nTambahan: ${tambahan.length ? tambahan.join(', ') : '-'}`;
}

/** Link WhatsApp dengan pesan terisi; tanpa nomor, WhatsApp meminta memilih kontak tujuan. */
export const whatsappShareLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
