# SiGaji di domain **cemerlang.online**

Anda **tidak perlu membuang** URL Netlify lama. Supabase mengizinkan **beberapa** alamat redirect sekaligus (invite, lupa password, konfirmasi email).

---

## 1. Netlify — pasang domain

1. Buka [Netlify](https://app.netlify.com) → situs SiGaji Anda  
2. **Domain management** → **Add domain** → `cemerlang.online`  
3. Ikuti petunjuk DNS di registrar domain Anda (A/CNAME ke Netlify)  
4. Tunggu SSL aktif (HTTPS hijau)  
5. **Primary domain** (opsional): set `cemerlang.online` sebagai domain utama  

SiGaji tetap bisa dibuka lewat URL `*.netlify.app` lama — keduanya boleh hidup.

---

## 2. Supabase — URL Auth (penting untuk email)

Dashboard Supabase → **Authentication** → **URL Configuration**

| Field | Isi disarankan |
|--------|----------------|
| **Site URL** | `https://cemerlang.online` |
| **Redirect URLs** | Tambahkan baris berikut (jangan hapus yang lama dulu): |

```
https://cemerlang.online
https://cemerlang.online/
https://cemerlang.online/**
https://NAMA-SITUS-ANDA.netlify.app
https://NAMA-SITUS-ANDA.netlify.app/**
http://localhost:8888
http://localhost:3333
```

Ganti `NAMA-SITUS-ANDA` dengan subdomain Netlify yang sekarang dipakai.

**Kenapa link email “kepake”?**  
Supabase hanya mengizinkan redirect ke URL yang ada di daftar. Domain baru **harus ditambah**; kalau hanya ada Netlify lama, link dari `cemerlang.online` ditolak.

---

## 3. Netlify — environment (opsional, disarankan)

**Site settings → Environment variables** → tambah:

| Variable | Nilai |
|----------|--------|
| `SIGAJI_SITE_URL` | `https://cemerlang.online` |

Dipakai saat Admin **approve registrasi** (email undangan / set password) agar link selalu ke domain Anda, meski header Netlify aneh.

Variabel lain tetap sama: `SIGAJI_SUPABASE_URL`, `SIGAJI_SUPABASE_SERVICE_ROLE_KEY`, dll.

---

## 4. Yang otomatis di kode SiGaji

| Fitur | Perilaku |
|--------|----------|
| **Lupa password** | `redirectTo` = alamat browser saat ini → buka dari `https://cemerlang.online` = link benar |
| **Approve registrasi** | `redirectTo` dari host request atau `SIGAJI_SITE_URL` |
| **Login / data** | Tetap Supabase yang sama — domain hanya “alamat web” |

Tidak perlu ganti `js/config.js` (URL Supabase API tetap `https://xxxx.supabase.co`).

---

## 5. Email SMTP (jika pakai custom SMTP)

Jika di Supabase sudah set SMTP untuk kirim email:

- Biasanya **tidak** perlu diubah hanya karena ganti domain web  
- Yang wajib diubah: **Redirect URLs** (langkah 2)

---

## 6. Cek setelah selesai

1. Buka `https://cemerlang.online` → login SiGaji  
2. **Lupa password** → email → klik link → harus kembali ke `cemerlang.online` (bukan error redirect)  
3. **Daftar email** → Admin approve → email undangan → set password di domain yang sama  

---

## Ringkas

| Yang diubah | Di mana |
|-------------|---------|
| DNS + domain | Netlify + registrar |
| Izin link email | Supabase → Redirect URLs (**tambah** cemerlang.online) |
| Site URL utama | Supabase → `https://cemerlang.online` |
| Opsional invite | Netlify env `SIGAJI_SITE_URL` |

**Jangan** hapus URL Netlify lama dari Supabase sampai yakin semua user sudah pakai domain baru.
