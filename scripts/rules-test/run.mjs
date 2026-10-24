// Jalankan semua uji rules secara berurutan di dalam emulator (dipanggil oleh `npm test`).
import { spawnSync } from 'node:child_process';

const files = ['firestore.test.mjs', 'storage.test.mjs', 'claims.test.mjs'];
let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: new URL('.', import.meta.url) });
  if (res.status !== 0) failed += 1;
}
console.log(failed ? `\nGAGAL: ${failed} dari ${files.length} berkas uji` : '\nSemua uji rules LULUS');
process.exit(failed ? 1 : 0);
