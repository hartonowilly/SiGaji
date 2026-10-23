/**
 * Data tenant untuk Cloudflare Functions: baca/tulis tabel v11 (sigaji_karyawan, sigaji_store, …),
 * blob sigaji_cloud hanya bila tabel belum dipakai. Tulis = hanya bagian yang berubah, digabung
 * dengan versi terbaru di awan (aplikasi web bisa sedang menyimpan bersamaan).
 */

const SNAP = Symbol('sigajiTenantSnapshot');
const STORE_KEYS_READ = ['perusahaan', 'masterCuti', 'hariLibur', 'users', 'absensi'];

let tablesCache = { tenant: '', ok: null, at: 0 };

export async function tablesReady(sb, tenant) {
  const now = Date.now();
  if (tablesCache.tenant === tenant && tablesCache.ok != null && now - tablesCache.at < 60000) {
    return tablesCache.ok;
  }
  const { data, error } = await sb
    .from('sigaji_tenant_meta')
    .select('tenant_key')
    .eq('tenant_key', tenant)
    .maybeSingle();
  const ok = !error && !!data;
  tablesCache = { tenant, ok, at: now };
  return ok;
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .sort()
      .filter((k) => v[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + stable(v[k]))
      .join(',') +
    '}'
  );
}

async function loadBlob(sb, tenant) {
  const { data: row, error } = await sb
    .from('sigaji_cloud')
    .select('payload')
    .eq('tenant_key', tenant)
    .maybeSingle();
  if (error) throw error;
  return (row && row.payload) || {};
}

async function readStoreKey(sb, tenant, key, fallback) {
  const { data, error } = await sb
    .from('sigaji_store')
    .select('data')
    .eq('tenant_key', tenant)
    .eq('store_key', key)
    .maybeSingle();
  if (error) throw error;
  return data && data.data != null ? data.data : fallback;
}

async function writeStoreKey(sb, tenant, key, value) {
  const { error } = await sb.from('sigaji_store').upsert(
    { tenant_key: tenant, store_key: key, data: value, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_key,store_key' }
  );
  if (error) throw error;
}

/**
 * Payload ringkas untuk API mobile/HRD: karyawan, periodes, perusahaan, masterCuti, hariLibur, users, absensi.
 * Simpan perubahan lewat saveCloudPayload (hanya selisih yang ditulis).
 */
export async function loadCloudPayload(sb, tenant) {
  if (!(await tablesReady(sb, tenant))) {
    const blob = await loadBlob(sb, tenant);
    return blob;
  }
  const [kar, per, store] = await Promise.all([
    sb.from('sigaji_karyawan').select('nik,data').eq('tenant_key', tenant),
    sb.from('sigaji_periode').select('nama,data').eq('tenant_key', tenant),
    sb
      .from('sigaji_store')
      .select('store_key,data')
      .eq('tenant_key', tenant)
      .in('store_key', STORE_KEYS_READ),
  ]);
  if (kar.error) throw kar.error;
  if (per.error) throw per.error;
  if (store.error) throw store.error;
  const st = {};
  (store.data || []).forEach((r) => {
    st[r.store_key] = r.data;
  });
  const payload = {
    karyawan: (kar.data || []).map((r) => Object.assign({ nik: r.nik }, r.data || {})),
    periodes: (per.data || []).map((r) => Object.assign({ nama: r.nama }, r.data || {})),
    perusahaan: st.perusahaan || {},
    masterCuti: st.masterCuti || {},
    hariLibur: Array.isArray(st.hariLibur) ? st.hariLibur : [],
    users: Array.isArray(st.users) ? st.users : [],
    absensi: st.absensi && typeof st.absensi === 'object' ? st.absensi : {},
  };
  Object.defineProperty(payload, SNAP, {
    value: { absensi: clone(payload.absensi), hariLibur: clone(payload.hariLibur) },
    enumerable: false,
    writable: true,
  });
  return payload;
}

/** Selisih absensi per tanggal: {nik: {tgl: status | null}} (null = dihapus). */
export function diffAbsensi(before, after) {
  const out = {};
  const b = before || {};
  const a = after || {};
  const niks = new Set(Object.keys(b).concat(Object.keys(a)));
  niks.forEach((nik) => {
    const bd = b[nik] || {};
    const ad = a[nik] || {};
    const days = new Set(Object.keys(bd).concat(Object.keys(ad)));
    days.forEach((d) => {
      const bv = bd[d] == null ? null : bd[d];
      const av = ad[d] == null ? null : ad[d];
      if (stable(bv) === stable(av)) return;
      if (!out[nik]) out[nik] = {};
      out[nik][d] = av;
    });
  });
  return out;
}

export function applyAbsensiChanges(absensi, changes) {
  const out = absensi && typeof absensi === 'object' ? absensi : {};
  Object.keys(changes || {}).forEach((nik) => {
    Object.keys(changes[nik]).forEach((d) => {
      const v = changes[nik][d];
      if (v == null) {
        if (out[nik]) {
          delete out[nik][d];
          if (!Object.keys(out[nik]).length) delete out[nik];
        }
      } else {
        if (!out[nik]) out[nik] = {};
        out[nik][d] = v;
      }
    });
  });
  return out;
}

/** Gabung daftar hari libur per tanggal: perubahan (before→after) diterapkan ke versi awan terbaru. */
export function mergeHariLibur(before, after, server) {
  const byTgl = (arr) => {
    const m = new Map();
    (arr || []).forEach((h) => {
      if (h && h.tgl) m.set(String(h.tgl).substring(0, 10), h);
    });
    return m;
  };
  const b = byTgl(before);
  const a = byTgl(after);
  const s = byTgl(server);
  const keys = new Set([...b.keys(), ...a.keys()]);
  keys.forEach((k) => {
    const bv = b.has(k) ? stable(b.get(k)) : null;
    const av = a.has(k) ? stable(a.get(k)) : null;
    if (bv === av) return;
    if (a.has(k)) s.set(k, a.get(k));
    else s.delete(k);
  });
  return [...s.keys()].sort().map((k) => s.get(k));
}

/** Status absensi satu karyawan pada satu tanggal (null bila kosong). */
export async function getAbsensiStatus(sb, tenant, nik, date) {
  let absensi;
  if (await tablesReady(sb, tenant)) absensi = await readStoreKey(sb, tenant, 'absensi', {});
  else absensi = (await loadBlob(sb, tenant)).absensi || {};
  return (absensi && absensi[nik] && absensi[nik][date]) || null;
}

/** Tulis perubahan absensi langsung (baca versi awan terbaru, terapkan selisih). */
export async function saveAbsensiChanges(sb, tenant, changes) {
  if (!changes || !Object.keys(changes).length) return;
  if (!(await tablesReady(sb, tenant))) {
    const blob = await loadBlob(sb, tenant);
    blob.absensi = applyAbsensiChanges(blob.absensi || {}, changes);
    await updateBlob(sb, tenant, blob);
    return;
  }
  const cur = await readStoreKey(sb, tenant, 'absensi', {});
  await writeStoreKey(sb, tenant, 'absensi', applyAbsensiChanges(cur, changes));
}

async function updateBlob(sb, tenant, payload) {
  const { error } = await sb
    .from('sigaji_cloud')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('tenant_key', tenant);
  if (error) throw error;
}

/**
 * Simpan payload hasil loadCloudPayload. Mode tabel: hanya absensi (per tanggal) dan hari libur yang berubah.
 * Mode blob (tabel belum dipakai): tulis blob seperti dulu.
 */
export async function saveCloudPayload(sb, tenant, payload) {
  const snap = payload && payload[SNAP];
  if (!snap) {
    await updateBlob(sb, tenant, payload);
    return;
  }
  const changes = diffAbsensi(snap.absensi, payload.absensi);
  if (Object.keys(changes).length) await saveAbsensiChanges(sb, tenant, changes);
  if (stable(snap.hariLibur) !== stable(payload.hariLibur)) {
    const server = await readStoreKey(sb, tenant, 'hariLibur', []);
    await writeStoreKey(
      sb,
      tenant,
      'hariLibur',
      mergeHariLibur(snap.hariLibur, payload.hariLibur, Array.isArray(server) ? server : [])
    );
  }
  snap.absensi = clone(payload.absensi);
  snap.hariLibur = clone(payload.hariLibur);
}

/**
 * Ubah daftar user (registrasi): tabel sigaji_store.users + blob (aplikasi mobile membaca user dari blob).
 * @param {(users: object[]) => boolean} mutate kembalikan true bila ada perubahan
 */
export async function updateUsersList(sb, tenant, mutate) {
  const useTables = await tablesReady(sb, tenant);
  let list;
  if (useTables) {
    const cur = await readStoreKey(sb, tenant, 'users', []);
    list = Array.isArray(cur) ? cur : [];
    if (!mutate(list)) return list;
    await writeStoreKey(sb, tenant, 'users', list);
  }
  const blob = await loadBlob(sb, tenant).catch(() => null);
  if (blob) {
    if (useTables) blob.users = list;
    else {
      list = Array.isArray(blob.users) ? blob.users : [];
      if (!mutate(list)) return list;
      blob.users = list;
    }
    await updateBlob(sb, tenant, blob);
  }
  return list || [];
}
