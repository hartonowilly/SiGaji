// Salin file ini → config.js untuk develop lokal.
// Deploy Netlify (repo publik): config.js dibuat otomatis — isi SIGAJI_SUPABASE_* di Netlify env.
// Lihat docs/REPO_PUBLIK_DAN_CONFIG.md
window.SIGAJI_SUPABASE_URL = 'https://xxxx.supabase.co';
window.SIGAJI_SUPABASE_ANON_KEY = 'eyJhbGci...';
/** Opsional: samakan dengan Netlify `SIGAJI_TENANT_KEY` bila payload tenant bukan `main`. */
window.SIGAJI_TENANT_KEY = '';
/**
 * Kuota karyawan — hanya Anda (penjual) yang set, lewat:
 * Supabase sigaji_tenant_meta, POST /.netlify/functions/license-set, atau angka di bawah.
 * Admin perusahaan pelanggan tidak bisa ubah kuota di aplikasi.
 */
window.SIGAJI_MAX_EMPLOYEES = 0;
/** Opsional: satu kali bantu login Admin pertama jika data belum punya email user sama sekali (isi email yang sama dengan Auth, lalu kosongkan lagi). */
window.SIGAJI_BOOTSTRAP_ADMIN_EMAIL = '';
/** Penyimpanan cloud: 'dual' (tabel + cadangan blob, disarankan), 'tables', atau 'blob' (lama). Butuh sql/supabase_sigaji_tables_v11.sql */
window.SIGAJI_STORAGE_MODE = 'dual';
/** Hanya di Netlify Environment (bukan config.js browser): SIGAJI_SITE_URL=https://cemerlang.online */
/** true = setelah refresh (F5) tetap masuk jika sesi Supabase masih valid. Wajib true untuk produksi cloud. */
window.SIGAJI_RESUME_SESSION_ON_LOAD = true;
/** Menit tanpa aktivitas → logout otomatis (0 = nonaktif). */
window.SIGAJI_IDLE_LOGOUT_MINUTES = 30;
/** true = tidak ada mode lokal (wajib Supabase). */
window.SIGAJI_CLOUD_ONLY_MODE = true;
