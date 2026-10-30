// Cetak lewat jendela browser (nota, slip gaji). Di HP & PC dialog cetak menyediakan "Simpan sebagai PDF", jadi tidak
// perlu library PDF.

export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/**
 * Buka jendela baru berisi html lalu tampilkan dialog cetak (jendela ditutup setelahnya).
 * html: dokumen lengkap tanpa skrip; skrip cetak ditambahkan di sini. false bila pop-up diblokir browser.
 */
export function openPrintWindow(html, features = 'width=400,height=600') {
  const win = window.open('', '_blank', features);
  if (!win) return false;
  const script =
    '<script>window.onload = function () { window.print(); setTimeout(function () { window.close(); }, 500); };</script>';
  win.document.open();
  win.document.write(html.replace('</body>', `${script}</body>`));
  win.document.close();
  return true;
}
