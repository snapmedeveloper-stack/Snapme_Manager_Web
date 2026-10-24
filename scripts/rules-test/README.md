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

**Deploy rules Firestore:** `firebase deploy --only firestore:rules` (firebase-tools 15.3.1) melaporkan sukses tetapi **tidak memasang apa pun** untuk database bernama `default`. Pasang lewat Firebase Console (Firestore → database `default` → Rules), atau lewat Rules API (lihat `Snapme_Desktop/docs/RENCANA_TANPA_ROLE.md`), lalu cocokkan isi rules yang aktif.
