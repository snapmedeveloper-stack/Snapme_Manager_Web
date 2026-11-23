# Uji rules Firebase

Menguji `../../firestore.rules`, `../../storage.rules`, dan logika tanda akses `../../functions/accessClaims.js` di Firebase Emulator (lokal, tidak menyentuh produksi). Jalankan setiap kali rules atau peran akun diubah, **sebelum** deploy.

```
cd scripts/rules-test
npm install            # sekali
npm test
```

Syarat:
- Firebase CLI.
- Java 21+. Kalau `java -version` masih 11, arahkan dulu ke JDK baru, misalnya di Git Bash:
  `export JAVA_HOME="/c/Program Files/Java/jdk-24" PATH="/c/Program Files/Java/jdk-24/bin:$PATH"`.
- `npm install` di folder `functions/` (uji tanda akses memakai `firebase-admin` dari sana).

Hasilnya harus `Semua uji rules LULUS`. Skenario baru ditambahkan di berkas `*.test.mjs` yang sesuai.

**Deploy rules Firestore:** `firebase deploy --only firestore:default:rules` (teruji 2026-11-24, firebase-tools 15.3.1; ikut memasang indeks `firestore.indexes.json` tanpa menghapus indeks lain). Jangan pakai `--only firestore:rules`: melaporkan sukses tetapi **tidak memasang apa pun** untuk database bernama `default`.
