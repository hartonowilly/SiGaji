-- SiGaji — jejak audit hanya untuk Admin/HRD (bukan Karyawan lewat NIK sendiri).
-- Jalankan di SQL Editor Supabase (aman diulang). Prasyarat: SQL v12 + pecah audit ke sigaji_item.

drop policy if exists v12_staff_select on public.sigaji_item;
create policy v12_staff_select on public.sigaji_item
  for select to authenticated
  using (
    tenant_key = any ((select public.sigaji_hq_tenants())::text[])
    or (tenant_key || '|' || cabang_id) = any ((select public.sigaji_branch_scopes())::text[])
    or (
      (tenant_key || '|' || nik) = any ((select public.sigaji_self_keys())::text[])
      and kind <> 'auditLog'
    )
  );
