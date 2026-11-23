// Penjelasan error dengan bahasa sehari-hari untuk owner (mode Log): judul singkat, apa artinya, dan yang perlu dilakukan.
// Pesan asli & detail teknis tetap ditampilkan terpisah untuk developer. Berlaku juga untuk catatan lama, karena hanya
// membaca event + isi context (Snapme_Desktop/electron/logEvents.json).

const has = (text, re) => re.test(String(text || ''));

// Kode error jaringan/disk Node → bahasa sehari-hari
const NET_DOWN = /ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET|socket hang up|Timeout/i;
const OFFLINE = /unavailable|offline|network|internet|ENOTFOUND|EAI_AGAIN|failed to fetch|deadline-exceeded/i;
const DISK_FULL = /ENOSPC|disk penuh/i;
const NO_ACCESS = /EPERM|EACCES|EBUSY|permission denied|operation not permitted/i;
const DENIED = /permission-denied|insufficient permissions/i;

const who = (ctx, subject) => ctx.customer || ctx.target || subject?.name || '';
const ofWho = (ctx, subject) => (who(ctx, subject) ? ` ${who(ctx, subject)}` : '');

/** Penjelasan umum dari isi error (dipakai bila event tidak punya penjelasan khusus). */
function fromErrorText(error) {
  if (has(error, DISK_FULL)) {
    return {
      meaning: 'Penyimpanan (disk) di PC itu penuh, jadi file tidak bisa ditulis.',
      action: 'Kosongkan disk PC itu (hapus/pindahkan folder lama), lalu ulangi.',
    };
  }
  if (has(error, DENIED)) {
    return {
      meaning: 'Server menolak karena izin akses. Biasanya karena akun studio atau aturan keamanan database.',
      action: 'Pastikan PC login dengan akun studio yang benar. Jika berulang, tekan "Salin untuk developer".',
    };
  }
  if (has(error, OFFLINE)) {
    return {
      meaning: 'Koneksi internet PC itu sedang terputus atau lambat.',
      action: 'Cek internet PC itu. Biasanya aplikasi mencoba lagi sendiri setelah internet kembali.',
    };
  }
  if (has(error, NO_ACCESS)) {
    return {
      meaning: 'File atau folder sedang dipakai program lain atau tidak boleh diubah.',
      action: 'Tutup program yang membuka file itu (mis. Lightroom/Explorer), lalu ulangi.',
    };
  }
  return null;
}

const RULES = [
  {
    when: (e) => e.event === 'wa.send_problem' && has(e.context.error, /belum terkonfirmasi/),
    explain: (c, s) => ({
      title: `${c.kind || 'Pesan'} WhatsApp ke${ofWho(c, s)} belum sampai ke HP customer`,
      meaning: `WhatsApp sudah menerima pesannya dari aplikasi, tapi belum ada centang sama sekali setelah ${
        String(c.error).match(/setelah (\d+) menit/)?.[1] || 'beberapa'
      } menit. Biasanya HP customer mati atau tanpa internet; pesan akan sampai sendiri saat HP-nya online lagi.`,
      action:
        'Buka chat customer di halaman Message. Jika sudah ada centang, tandai sudah ditangani. Jika sampai besok belum juga, hubungi customer lewat cara lain.',
    }),
  },
  {
    when: (e) => e.event === 'wa.send_problem' && has(e.context.error, /ditolak WhatsApp/),
    explain: (c, s) => ({
      title: `${c.kind || 'Pesan'} WhatsApp ke${ofWho(c, s)} ditolak WhatsApp`,
      meaning: `WhatsApp tidak mau mengirim pesan ini (${String(c.error).replace(/^ditolak WhatsApp:\s*/, '')}).`,
      action: has(c.error, /terlalu besar|diunggah/)
        ? 'File terlalu besar untuk WhatsApp. Kirim link Google Drive-nya saja.'
        : 'Kirim ulang dari halaman Message. Jika tetap ditolak, cek nomor customer benar dan aktif di WhatsApp.',
    }),
  },
  {
    when: (e) => e.event === 'wa.send_problem',
    explain: (c, s) => ({
      title: `${c.kind || 'Pesan'} WhatsApp ke${ofWho(c, s)} gagal dikirim`,
      meaning: 'Pesan tidak sampai ke WhatsApp. Biasanya WhatsApp di PC server sedang terputus atau nomornya salah.',
      action: 'Cek WhatsApp tersambung di halaman Message (PC server), lalu kirim ulang ke customer.',
    }),
  },
  {
    when: (e) => e.event === 'auto.lan_sync_failed' && has(e.context.error, NET_DOWN),
    explain: (c) => ({
      title: `${c.failed || 'Beberapa'} foto dari PC lain gagal disalin lewat jaringan`,
      meaning:
        'PC ini tidak bisa menghubungi PC sumber foto. Biasanya PC sumber dimatikan, pindah Wi-Fi, atau (sebelum versi perbaikan) dihubungi lewat alamat jaringan yang salah.',
      action:
        'Pastikan kedua PC menyala dan satu Wi-Fi/LAN. Foto dicoba lagi otomatis setiap beberapa detik; cek jumlah foto di folder booking. Jika sering terjadi, update aplikasi di semua PC.',
    }),
  },
  {
    when: (e) => e.event === 'auto.lan_sync_failed' && has(e.context.error, /ENOENT/),
    explain: (c) => ({
      title: `${c.failed || 'Beberapa'} foto dari PC lain gagal disimpan di PC ini`,
      meaning:
        'File yang sedang disalin hilang di tengah jalan, biasanya karena foldernya sedang dirapikan (mis. RAW EDIT FIRST) pada saat yang sama.',
      action:
        'Tidak perlu tindakan: foto dicoba lagi otomatis. Jika berulang setelah update, tekan "Salin untuk developer".',
    }),
  },
  {
    when: (e) => e.event === 'auto.lan_sync_failed',
    textFirst: true,
    explain: (c) => ({
      title: `${c.failed || 'Beberapa'} foto dari PC lain gagal disalin`,
      meaning: 'Sebagian foto booking hari ini belum tersalin ke PC ini dari PC lain.',
      action: 'Foto dicoba lagi otomatis. Cek jumlah foto di folder booking; jika tetap kurang, salin manual.',
    }),
  },
  {
    when: (e) => e.event === 'print.failed' && has(e.context.error, /Invalid deviceName|tidak terpasang/),
    explain: (c) => ({
      title: `Printer "${c.printer || '-'}" tidak ada di PC itu`,
      meaning: 'Printer yang dipilih di Setting PC itu tidak terpasang atau tidak tersambung, jadi foto tidak dicetak.',
      action: 'Di PC itu buka Setting → Printer, pilih printer yang tersedia, lalu cetak ulang.',
    }),
  },
  {
    when: (e) => e.event === 'print.failed' && has(e.context.error, /cancel/i),
    explain: (c, s) => ({
      title: `Cetak foto${ofWho(c, s)} dibatalkan`,
      meaning: 'Pekerjaan cetak dibatalkan, oleh staff di dialog printer atau oleh printer sendiri.',
      action:
        'Jika foto sudah dicetak ulang setelahnya, tandai sudah ditangani. Jika belum, cek printer lalu cetak ulang.',
    }),
  },
  {
    when: (e) => e.event === 'print.failed',
    explain: (c, s) => ({
      title: `Cetak foto${ofWho(c, s)} gagal`,
      meaning: 'Printer tidak menerima pekerjaan cetak.',
      action: 'Cek printer menyala, kertas dan tinta ada, lalu cetak ulang dari halaman Print.',
    }),
  },
  {
    when: (e) => e.event === 'sistem.console_error' && has(e.context.error, /media-protocol\] File not found/),
    explain: () => ({
      title: 'Foto untuk pratinjau tidak ditemukan di PC itu',
      meaning:
        'Halaman Print menampilkan foto yang belum ada di PC itu: file EDIT masih disimpan, atau fotonya baru ada di PC lain dan belum tersalin.',
      action: 'Tidak perlu tindakan. Sejak versi perbaikan, ini tidak lagi dicatat sebagai error.',
    }),
  },
  {
    when: (e) => e.event === 'sistem.console_error' && has(e.context.error, /UDP Send Error/),
    explain: () => ({
      title: 'Pencarian PC lain gagal di satu kartu jaringan',
      meaning:
        'PC itu punya kartu jaringan yang tidak tersambung (alamat 169.254.x). Pencarian lewat Wi-Fi/LAN yang tersambung tetap berjalan.',
      action: 'Tidak perlu tindakan. Sejak versi perbaikan, ini tidak lagi dicatat.',
    }),
  },
  {
    when: (e) => e.event === 'log.invalid',
    explain: () => ({
      title: 'Aplikasi di PC itu masih memakai versi lama',
      meaning:
        'Aplikasi mencoba mencatat kejadian yang belum dikenal versi yang sedang berjalan, jadi catatan itu tidak disimpan.',
      action: 'Tutup lalu buka ulang aplikasi di PC itu (atau pasang update).',
    }),
  },
  {
    when: (e) => e.event === 'log.upload_rejected',
    explain: () => ({
      title: 'Catatan log ditolak server',
      meaning: 'Satu catatan log dari PC itu tidak diterima server, jadi tidak muncul di sini.',
      action: 'Tidak berpengaruh ke pekerjaan studio. Jika berulang, tekan "Salin untuk developer".',
    }),
  },
  {
    when: (e) => e.event === 'log.cap_reached',
    explain: () => ({
      title: 'Terlalu banyak error dalam sehari',
      meaning: 'PC itu mencatat sangat banyak error hari ini; sisanya tidak dikirim satu per satu.',
      action: 'Lihat error lain dari PC itu untuk mencari penyebabnya, lalu buka ulang aplikasinya.',
    }),
  },
  {
    when: (e) => e.event.startsWith('crash.') && e.event !== 'crash.chromium',
    explain: (c) => ({
      title: c.page ? `Aplikasi error di halaman ${c.page}` : 'Aplikasi mengalami error',
      meaning: 'Ada bagian program yang gagal berjalan. Halaman bisa kosong atau tombol tidak bereaksi.',
      action: 'Jika staff terganggu, tutup dan buka ulang aplikasi. Jika berulang, tekan "Salin untuk developer".',
    }),
  },
  {
    when: (e) => e.event === 'crash.chromium' || e.event.startsWith('wa.'),
    explain: () => ({
      title: 'WhatsApp di PC server bermasalah',
      meaning: 'WhatsApp di PC server terputus atau gagal berjalan, jadi pesan bisa tertunda.',
      action:
        'Buka halaman Message di PC server dan cek statusnya. Jika diminta, scan QR ulang. Pesan antrean dikirim lagi setelah tersambung.',
    }),
  },
  {
    when: (e) => e.event.startsWith('auto.drive') || e.event === 'setting.drive_reconnect_failed',
    textFirst: true,
    explain: (c, s) => ({
      title: `Upload Google Drive${ofWho(c, s)} bermasalah`,
      meaning: 'Foto atau folder belum bisa disimpan ke Google Drive.',
      action: 'Cek internet dan login Google Drive akun studio di Setting. Upload dicoba lagi otomatis.',
    }),
  },
  {
    when: (e) => e.event === 'setting.config_missing',
    explain: (c) => ({
      title: `${c.what || 'Pengaturan'} belum diatur`,
      meaning: c.impact ? `Akibatnya: ${c.impact}.` : 'Ada pengaturan yang belum diisi di PC itu.',
      action: 'Isi pengaturannya di Setting PC itu.',
    }),
  },
  {
    when: (e) => e.event === 'sistem.ui_error',
    textFirst: true,
    explain: (c) => ({
      title: 'Staff melihat pesan error di layar',
      meaning: `Aplikasi menampilkan pesan error ke staff${c.where ? ` di ${c.where}` : ''}.`,
      action: 'Tanyakan ke staff apa yang sedang dikerjakan. Jika berulang, tekan "Salin untuk developer".',
    }),
  },
  {
    when: (e) => /save_failed$/.test(e.event),
    textFirst: true,
    explain: () => ({
      title: 'Perubahan gagal disimpan',
      meaning: 'Data yang diubah staff tidak tersimpan ke server.',
      action: 'Minta staff mengecek datanya dan mengulang perubahan. Cek juga internet PC itu.',
    }),
  },
];

const FALLBACK = {
  meaning: 'Ada proses di aplikasi yang tidak berjalan semestinya.',
  action: 'Jika berulang atau mengganggu pekerjaan, tekan "Salin untuk developer" dan kirim ke developer.',
};

/**
 * Penjelasan satu error/kelompok error: { title, meaning, action }. entry = { event, message, context, subject }.
 * Event tanpa penjelasan khusus memakai pesan aslinya sebagai judul. Masalah disk/izin/internet yang terbaca dari
 * context.error dipakai bila event tidak punya penjelasan khusus, atau penjelasannya umum (textFirst).
 */
export function explainError(entry) {
  const e = { event: entry?.event || '', context: entry?.context || {}, subject: entry?.subject || null };
  const rule = RULES.find((r) => r.when(e));
  const specific = rule ? rule.explain(e.context, e.subject) : null;
  const byText = fromErrorText(e.context.error);
  const title = specific?.title || entry?.message || e.event;
  const detail = byText && (!rule || rule.textFirst) ? byText : specific || byText || FALLBACK;
  return { title, meaning: detail.meaning, action: detail.action };
}
