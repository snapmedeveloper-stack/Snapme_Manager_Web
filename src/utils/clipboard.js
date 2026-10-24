/**
 * Salin teks ke clipboard. Clipboard API hanya ada di HTTPS/localhost; di luar itu (mis. dev server dibuka dari HP
 * lewat IP lokal) dipakai cara lama lewat textarea tersembunyi. Melempar Error bila keduanya gagal.
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Browser tidak mengizinkan menyalin.');
}
