SiGaji — struktur modular
=========================

Cara pakai
----------
Buka index.html dengan browser atau deploy ke Cloudflare Pages.
Build: npm install && npm run build (rakit HTML + generate config.js).

Struktur
--------
index.template.html  Shell HTML (sumber)
partials/            Fragment halaman (mis. pg-absensi.html)
index.html           Hasil rakit (npm run assemble)
css/                 Gaya
js/modules/          Logika aplikasi + app-boot.js, app-api-shim.js
_archive/            Arsip monolit lama (jangan dimuat di produksi)

Skema data (schemaVersion)
----------------------------
Versi disimpan di objek sigaji_db (localStorage) bersama data karyawan, dll.
Saat ini SCHEMA_VERSION = 2 (pastikan ptkp_nilai ada di perusahaan).

Untuk upgrade fitur baru: naikkan SCHEMA_VERSION di js/constants.js,
tambah cabang if(v<N) di migrateStorage() pada js/storage.js,
lalu isi field baru dengan default aman.

Regenerate dari monolit (opsional)
-----------------------------------
Jika Anda menyalin sigaji_cursor.html ke folder di atas dan menjalankan:
  python _extract_bundle.py
skrip akan menimpa css/js/index dari monolit. Periksa duplikat path setelah extract.

File sigaji_cursor.html satu-file di folder Downloads tetap bisa dipakai;
versi modular ini disarankan untuk pengembangan berikutnya.
