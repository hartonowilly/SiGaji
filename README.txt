SiGaji — struktur modular (tanpa build step)
==========================================

Cara pakai
----------
Buka file index.html dari folder ini dengan browser (double-click atau Live Server).
Pastikan seluruh folder sigaji-app tetap utuh (css/, js/).

Struktur
--------
index.html     Halaman utama (tanpa inline CSS/JS besar)
css/styles.css Semua gaya
js/constants.js Konstanta: TER, MODULES, PTKP default, SCHEMA_VERSION
js/storage.js   localStorage, migrasi skema, variabel aplikasi, saveAll
js/ptkp.js      Helper nilai PTKP dari Master Perusahaan
js/app.js       Sisanya (UI, hitung gaji, laporan, dll.)

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
