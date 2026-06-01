# DNS cemerlang.online → Cloudflare (bukan Netlify)

## Gejala

- `https://www.cemerlang.online` → SiGaji baru (Cloudflare) ✓  
- `https://cemerlang.online` → masih situs lama Netlify ✗  
- Daftar email gagal di satu domain, jalan di domain lain

Penyebab: **DNS record berbeda** untuk `www` vs **apex** (`@`).

---

## 1. Cloudflare Pages — tambah domain apex

**Workers & Pages → sigaji → Custom domains → Set up a custom domain**

Tambahkan **keduanya** (jika belum):

- `www.cemerlang.online`
- `cemerlang.online`

Tunggu status **Active** untuk keduanya.

---

## 2. Hostinger — DNS

Buka **Domains → cemerlang.online → DNS / DNS records**.

### Hapus / ubah yang mengarah ke Netlify

Cari record untuk **@** (apex) atau **cemerlang.online** tanpa `www`:

| Tipe | Nama | Nilai lama (contoh Netlify) | Tindakan |
|------|------|-----------------------------|----------|
| A | @ | `75.2.60.5` atau IP Netlify | **Hapus** atau ganti |
| CNAME | @ | `apex-loadbalancer.netlify.com` | **Hapus** |

Jangan hapus record **email** (MX, TXT DKIM) kecuali Anda paham dampaknya.

### Arahkan apex ke Cloudflare Pages

**Opsi A — Redirect di Hostinger (paling mudah)**

1. **Domains → Redirects** (atau Domain redirect)  
2. `cemerlang.online` → `https://www.cemerlang.online` — **Permanent (301)**

Lalu di DNS, pastikan **www** tetap:

| Tipe | Nama | Nilai |
|------|------|--------|
| CNAME | www | `sigaji.pages.dev` |

**Opsi B — Apex langsung ke Cloudflare**

Jika Hostinger mendukung **ALIAS/CNAME** untuk root:

| Tipe | Nama | Nilai |
|------|------|--------|
| CNAME | @ | `sigaji.pages.dev` |

Atau ikuti IP yang ditampilkan Cloudflare saat menambah custom domain `cemerlang.online`.

---

## 3. Netlify — lepas domain (disarankan)

Netlify → situs lama → **Domain management** → hapus `cemerlang.online` / set redirect ke `www.cemerlang.online`.

Supaya tidak bentrok SSL/DNS.

---

## 4. Environment Cloudflare

| Variable | Nilai |
|----------|--------|
| `SIGAJI_SITE_URL` | `https://www.cemerlang.online/` |

**Supabase → Authentication → Redirect URLs** — tambahkan:

```
https://www.cemerlang.online
https://www.cemerlang.online/**
https://cemerlang.online
https://cemerlang.online/**
https://sigaji.pages.dev/**
```

**Site URL** Supabase: `https://www.cemerlang.online`

---

## 5. Uji setelah DNS (5–30 menit)

1. Browser privat: buka `https://cemerlang.online` → harus ke **www** (Cloudflare), bukan Netlify.  
2. Buka `https://www.cemerlang.online/api/health` → JSON `{"ok":true,"service":"sigaji-api"}`.  
3. **Daftar Email** → F12 → Network → `POST .../api/auth-register-request` → JSON, bukan HTML.

Jika `/api/health` mengembalikan halaman login HTML, Functions belum aktif — deploy ulang dan cek **nodejs_compat** di `wrangler.toml`.

---

## Ringkas

| Host | Harus mengarah ke |
|------|-------------------|
| www | CNAME `sigaji.pages.dev` (Cloudflare) |
| apex (@) | Redirect ke www **ata** CNAME/IP Cloudflare — **bukan** Netlify |
