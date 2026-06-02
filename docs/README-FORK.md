# Fork / repo per perusahaan (basis tetap SiGaji)

Cocok jika tiap PT punya **kebijakan sendiri** (modul, teks, branding) tetapi Anda tetap pegang **inti produk** dan **1 Supabase hosted**.

Multi-tenant & tenant ke-2: **[MULTI_TENANT_HOSTED.md](MULTI_TENANT_HOSTED.md)**.

---

## Konsep

```text
sigaji-app          ← upstream (Anda): bugfix, PPh, slip, cloud
    │
    ├── sigaji-cemerlang     → deploy → SIGAJI_TENANT_KEY=main
    ├── sigaji-pt-maju       → deploy → SIGAJI_TENANT_KEY=pt_maju
    └── sigaji-pt-xyz        → deploy → SIGAJI_TENANT_KEY=pt_xyz
              │
              └── merge / cherry-pick dari upstream saat rilis
```

| Lapisan | Satu atau banyak? |
|---------|-------------------|
| Repo Git | **Banyak** (fork per PT) |
| Supabase | **Satu** (hosted) — bisa dedicated untuk PT besar |
| Cloudflare Pages | **Satu project per URL** |
| `tenant_key` | **Satu per PT** di env |

---

## Membuat repo klien baru

### 1. Fork atau salin

**GitHub:** Fork `sigaji-app` → rename mis. `sigaji-pt-maju`.

**Atau salin folder** (tanpa history):

```bash
git clone https://github.com/ANDA/sigaji-app.git sigaji-pt-maju
cd sigaji-pt-maju
rm -rf .git
git init
git remote add upstream https://github.com/ANDA/sigaji-app.git
```

### 2. Kustomisasi di repo klien (contoh)

File yang sering dibedakan per PT:

| Area | File / cara |
|------|-------------|
| Branding | `index.html`, `css/ui-refresh.css`, logo |
| Modul | `js/constants.js` → `MODULES` |
| Env deploy | Cloudflare dashboard (bukan commit secret) |
| Tenant | `SIGAJI_TENANT_KEY=pt_maju` |
| Kebijakan | Matikan tab, teks help, dll. di `app-shell.js` / HTML |

**Jangan** commit `js/config.js` (gitignore) — isi lewat build env.

### 3. Cloudflare project baru

- Connect repo **fork** PT itu.
- Env: lihat [MULTI_TENANT_HOSTED.md](MULTI_TENANT_HOSTED.md) langkah 5.
- `SIGAJI_SUPABASE_*` = **sama** dengan proyek hosted Anda.
- `SIGAJI_TENANT_KEY` = key SQL (`pt_maju`).
- Build: `npm install && npm run build`.

### 4. Supabase

Jalankan `sql/supabase_tenant_add.sql` untuk `tenant_key` PT itu (sekali di DB bersama).

---

## Sync versi dari upstream

Saat Anda rilis perbaikan di `sigaji-app`:

```bash
cd sigaji-pt-maju
git remote add upstream https://github.com/ANDA/sigaji-app.git   # sekali
git fetch upstream
git merge upstream/master   # atau cherry-pick commit tertentu
# Selesaikan konflik di file yang PT kustom
git push
```

Cloudflare auto-deploy dari branch production fork.

**Tips:** Pisahkan kustom PT di commit terpisah agar merge lebih mudah.

---

## Apa yang tidak perlu di-fork

| Item | Alasan |
|------|--------|
| Supabase baru | Hosted = 1 DB kecuali kontrak dedicated |
| `tenant_key` di kode hardcode | Pakai env `SIGAJI_TENANT_KEY` |
| Duplikasi SQL skema | Skema sekali; tambah tenant pakai `supabase_tenant_add.sql` |

---

## Checklist repo + tenant baru

- [ ] Fork / repo baru
- [ ] Kustom kebijakan (jika ada)
- [ ] `supabase_tenant_add.sql` di Supabase (`__TENANT_KEY__` diganti)
- [ ] Cloudflare project + env + DNS
- [ ] Redirect URL Supabase Auth
- [ ] Admin pertama + tes gaji + kuota

---

## File terkait

- [MULTI_TENANT_HOSTED.md](MULTI_TENANT_HOSTED.md)
- [ONBOARDING_KLIEN_PT.md](ONBOARDING_KLIEN_PT.md)
- [REPO_PUBLIK_DAN_CONFIG.md](REPO_PUBLIK_DAN_CONFIG.md)
