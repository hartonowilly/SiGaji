-- =============================================================================
-- Set kuota lisensi (PENJUAL) — jalankan di Supabase → SQL Editor
-- =============================================================================
-- Jangan pakai Table Editor untuk max_employees / plan_label (trigger melindungi).
-- SQL Editor jalan sebagai postgres → boleh mengubah kuota.
--
-- Sesuaikan tenant_key, angka, dan nama paket di bawah ini.

insert into public.sigaji_tenant_meta (
  tenant_key,
  schema_version,
  max_employees,
  plan_label,
  storage_note,
  updated_at
)
values (
  'main',
  10,
  20,
  'Basic',
  'license set by vendor',
  now()
)
on conflict (tenant_key) do update set
  max_employees = excluded.max_employees,
  plan_label = excluded.plan_label,
  updated_at = excluded.updated_at;

-- Verifikasi:
-- select tenant_key, max_employees, plan_label from public.sigaji_tenant_meta where tenant_key = 'main';
