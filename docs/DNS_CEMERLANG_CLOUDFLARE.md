# DNS cemerlang.online → Cloudflare (bukan Netlify)

## Gejala

- `https://www.cemerlang.online` → SiGaji baru (Cloudflare) ✓  
- `https://cemerlang.online` → masih situs lama Netlify ✗  
- Daftar email gagal di satu domain, jalan di domain lain

Penyebab: **DNS record berbeda** untuk `www` vs **apex** (`@`).

---

## 1. Cloudflare Pages — custom domain

### `www.cemerlang.online` (sudah jalan)

DNS di **Hostinger** cukup **CNAME** `www` → `sigaji.pages.dev`. Cloudflare Pages langsung **Active** — tidak perlu pindah DNS.

### `cemerlang.online` (tanpa www) — layar “Transfer DNS management”

Kalau saat menambah apex Cloudflare menawarkan **Begin DNS transfer**, itu **normal**: DNS domain masih di **Hostinger**, bukan di zona Cloudflare. Untuk root/apex, Pages sering minta **seluruh DNS** pindah ke Cloudflare.

**Anda tidak wajib** klik “Begin DNS transfer” kecuali mau mengelola semua DNS (MX email, dll.) di Cloudflare.

**Disarankan (DNS tetap di Hostinger):**

1. **Jangan** tambahkan `cemerlang.online` di Pages (batal / tutup wizard transfer).
2. Di **Hostinger → Redirects**: `cemerlang.online` → `https://www.cemerlang.online` (301).
3. Hanya **`www.cemerlang.online`** sebagai custom domain di Pages (status Active).

Pengguna yang ketik `cemerlang.online` tetap sampai ke SiGaji lewat redirect ke www.

**Opsional** — mau apex tanpa transfer penuh: di Hostinger, jika ada **ALIAS/CNAME** untuk `@`, arahkan ke `sigaji.pages.dev` (lihat opsi B di bawah). Tidak semua panel Hostinger mendukung CNAME di root.

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

**Opsi A — Redirect di Hostinger (DNS saja, tanpa hosting)**

Menu **bukan** “Redirect your domain → Custom / Facebook” (itu sering error *cannot redirect to itself*).

Langkah di **hPanel**:

1. **Domains** (sidebar) → **Domain portfolio** → klik **Manage** di `cemerlang.online`
2. Buka **DNS / Nameservers**
3. Pilih tab **Redirects** (bukan hanya daftar DNS records)
4. Isi:
   - **Redirect from:** otomatis `cemerlang.online` (jangan isi www di sini)
   - **Redirect to:** `https://www.cemerlang.online` (huruf **https**, jangan `:tps`)
   - **Redirect type:** **Permanent (301)**
5. **Create redirect**

Domain harus memakai **nameserver Hostinger** (bukan nameserver lain), kalau tidak tab Redirects tidak jalan.

Jika tab **Redirects** tidak ada: lewat **Opsi B** (ALIAS) atau cukup pakai `www` saja.

Lalu di **DNS records**, pastikan **www** tetap:

| Tipe | Nama | Nilai |
|------|------|--------|
| CNAME | www | `sigaji.pages.dev` |

**Opsi B — Apex lewat DNS (tanpa menu Redirect)**

Di **DNS / Nameservers → DNS records** (Hostinger):

1. **Hapus** record **A** / **CNAME** lama untuk **@** yang ke Netlify.
2. **Tambah** record (Hostinger sering menampilkan sebagai **ALIAS** setelah disimpan):

| Tipe (pilih di dropdown) | Nama (Host) | Target / Points to |
|--------------------------|-------------|---------------------|
| **CNAME** | **@** | `sigaji.pages.dev` |

Di Hostinger, CNAME dengan nama **@** kadang disimpan sebagai **ALIAS** — itu normal.

3. Record **www** tetap:

| Tipe | Nama | Target |
|------|------|--------|
| CNAME | www | `sigaji.pages.dev` |

SSL apex bisa tetap bermasalah sampai custom domain `cemerlang.online` Active di Cloudflare Pages; kalau ribet, cukup **Opsi A** atau hanya pakai **www**.

**Opsi C — Tidak atur apex**

Hanya promosikan **`https://www.cemerlang.online`**. SiGaji sudah jalan di www.

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
