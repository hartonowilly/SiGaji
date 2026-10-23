/**
 * Data tenant untuk Cloudflare Functions: baca/tulis tabel v11 (sigaji_karyawan, sigaji_store, …),
 * blob sigaji_cloud hanya bila tabel belum dipakai. Tulis = hanya bagian yang berubah, digabung
 * dengan versi terbaru di awan (aplikasi web bisa sedang menyimpan bersamaan).
 */

const SNAP = Symbol('sigajiTenantSnapshot');
const STORE_KEYS_READ = ['perusahaan', 'masterCuti', 'hariLibur', 'users', 'absensi'];
const PAGE = 1000;

let tablesCache = { tenant: '', ok: null, at: 0 };
let itemsCache = { tenant: '', ok: null, at: 0 };

/** SQL v12 sudah dijalankan: absensi per baris di sigaji_item (bukan dokumen store). */
export async function itemsReady(sb, tenant) {
  const now = Date.now();
  if (itemsCache.tenant === tenant && itemsCache.ok != null && now - itemsCache.at < 60000) {
    return itemsCache.ok;
  }
  const { error } = await sb.from('sigaji_item').select('kind').eq('tenant_key', tenant).limit(1);
  const ok = !error;
  itemsCache = { tenant, ok, at: now };
  return ok;
}

/** Semua baris (PostgREST membatasi jumlah baris per respons). */
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; ) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (!rows.length) return out;
    from += rows.length;
  }
}

function monthOf(date) {
  const m = /^(\d{4}-\d{2})/.exec(String(date));
  return m ? m[1] : 'lain';
}

async function loadAbsensiItems(sb, tenant, nik) {
  const rows = await fetchAll(() => {
    let q = sb
      .from('sigaji_item')
      .select('item_key,nik,data')
      .eq('tenant_key', tenant)
      .eq('kind', 'absensi');
    if (nik) q = q.eq('nik', nik);
    return q.order('item_key');
  });
  const out = {};
  rows.forEach((r) => {
    if (!r.nik || !r.data || typeof r.data !== 'object') return;
    out[r.nik] = Object.assign(out[r.nik] || {}, r.data);
  });
  return out;
}

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
  const useItems = await itemsReady(sb, tenant);
  const storeKeys = useItems ? STORE_KEYS_READ.filter((k) => k !== 'absensi') : STORE_KEYS_READ;
  const [kar, per, store, itemAbs] = await Promise.all([
    fetchAll(() => sb.from('sigaji_karyawan').select('nik,data').eq('tenant_key', tenant).order('nik')),
    fetchAll(() => sb.from('sigaji_periode').select('nama,data').eq('tenant_key', tenant).order('nama')),
    sb.from('sigaji_store').select('store_key,data').eq('tenant_key', tenant).in('store_key', storeKeys),
    useItems ? loadAbsensiItems(sb, tenant) : Promise.resolve(null),
  ]);
  if (store.error) throw store.error;
  const st = {};
  (store.data || []).forEach((r) => {
    st[r.store_key] = r.data;
  });
  const absensi = itemAbs || (st.absensi && typeof st.absensi === 'object' ? st.absensi : {});
  const payload = {
    karyawan: kar.map((r) => Object.assign({ nik: r.nik }, r.data || {})),
    periodes: per.map((r) => Object.assign({ nama: r.nama }, r.data || {})),
    perusahaan: st.perusahaan || {},
    masterCuti: st.masterCuti || {},
    hariLibur: Array.isArray(st.hariLibur) ? st.hariLibur : [],
    users: Array.isArray(st.users) ? st.users : [],
    absensi,
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
  if (await tablesReady(sb, tenant)) {
    if (await itemsReady(sb, tenant)) {
      const { data, error } = await sb
        .from('sigaji_item')
        .select('data')
        .eq('tenant_key', tenant)
        .eq('kind', 'absensi')
        .eq('item_key', nik + '|' + monthOf(date))
        .maybeSingle();
      if (error) throw error;
      return (data && data.data && data.data[date]) || null;
    }
    absensi = await readStoreKey(sb, tenant, 'absensi', {});
  } else absensi = (await loadBlob(sb, tenant)).absensi || {};
  return (absensi && absensi[nik] && absensi[nik][date]) || null;
}

/**
 * Absensi per baris (nik|bulan): baca versi, terapkan selisih, simpan hanya bila versi belum berubah
 * (sigaji_save_rows). Bentrok dengan penyimpanan bersamaan → ulangi dengan data terbaru.
 */
async function saveAbsensiItems(sb, tenant, changes) {
  const groups = new Map();
  Object.keys(changes).forEach((nik) => {
    Object.keys(changes[nik]).forEach((d) => {
      const key = nik + '|' + monthOf(d);
      if (!groups.has(key)) groups.set(key, { nik, days: {} });
      groups.get(key).days[d] = changes[nik][d];
    });
  });
  let pending = [...groups.keys()];
  for (let round = 0; pending.length && round < 4; round++) {
    const { data: rows, error } = await sb
      .from('sigaji_item')
      .select('item_key,data,version')
      .eq('tenant_key', tenant)
      .eq('kind', 'absensi')
      .in('item_key', pending);
    if (error) throw error;
    const cur = new Map((rows || []).map((r) => [r.item_key, r]));
    const upserts = [];
    const deletes = [];
    pending.forEach((key) => {
      const g = groups.get(key);
      const row = cur.get(key);
      const merged = applyAbsensiChanges({ [g.nik]: Object.assign({}, (row && row.data) || {}) }, { [g.nik]: g.days });
      const days = merged[g.nik] || {};
      const k = { kind: 'absensi', item_key: key };
      const base = row ? row.version : null;
      if (Object.keys(days).length) upserts.push({ key: k, nik: g.nik, data: days, base_version: base });
      else if (row) deletes.push({ key: k, base_version: base });
    });
    const { data: res, error: re } = await sb.rpc('sigaji_save_rows', {
      p_table: 'item',
      p_upserts: upserts,
      p_deletes: deletes,
      p_tenant: tenant,
    });
    if (re) throw re;
    if (res && res.errors && res.errors.length) {
      throw new Error('Simpan absensi gagal: ' + res.errors.map((e) => e.message).join('; '));
    }
    pending = ((res && res.conflicts) || []).map((c) => c.key.item_key);
  }
  if (pending.length) throw new Error('Absensi sedang diubah bersamaan — coba lagi');
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
  if (await itemsReady(sb, tenant)) {
    await saveAbsensiItems(sb, tenant, changes);
    return;
  }
  const cur = await readStoreKey(sb, tenant, 'absensi', {});
  await writeStoreKey(sb, tenant, 'absensi', applyAbsensiChanges(cur, changes));
}

/**
 * Cakupan cabang pemanggil: null = kantor pusat (Admin, atau HRD tanpa cabang), selain itu Set id cabang.
 * @param {{role?: string, cabangId?: string}|null} me baris Manajemen User
 */
export function cabangScope(me) {
  if (!me || me.role === 'Admin') return null;
  const ids = String(me.cabangId || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

export function karyawanCabangId(k) {
  const id = String((k && (k.cabangId || k.cabang)) || '').trim();
  return id || 'utama';
}

/** Saring daftar karyawan sesuai cakupan cabang. */
export function filterKaryawanByScope(list, scope) {
  if (!scope) return list || [];
  return (list || []).filter((k) => k && scope.has(karyawanCabangId(k)));
}

/** Lempar 403 bila NIK di luar cabang pemanggil. */
export async function assertNikInScope(sb, tenant, me, nik) {
  const scope = cabangScope(me);
  if (!scope) return;
  let k = null;
  if (await tablesReady(sb, tenant)) {
    const { data, error } = await sb
      .from('sigaji_karyawan')
      .select('data')
      .eq('tenant_key', tenant)
      .eq('nik', nik)
      .maybeSingle();
    if (error) throw error;
    k = data && data.data;
  } else {
    k = ((await loadBlob(sb, tenant)).karyawan || []).find((x) => x && String(x.nik) === String(nik));
  }
  if (!k || !scope.has(karyawanCabangId(k))) {
    throw new Error('Forbidden — karyawan di luar cabang Anda');
  }
}

/** Hanya kantor pusat (Admin / HRD tanpa cabang). */
export function assertHq(me) {
  if (cabangScope(me)) throw new Error('Forbidden — hanya Admin / HRD kantor pusat');
}

/** Lokasi kerja: cabang_id kosong = bersama; selain itu harus masuk cakupan. */
export function locationVisible(loc, scope) {
  if (!scope) return true;
  if (!loc) return false;
  const id = String(loc.cabang_id || '').trim();
  return !id || scope.has(id);
}

export function filterLocationsByScope(list, scope) {
  if (!scope) return list || [];
  return (list || []).filter((l) => locationVisible(l, scope));
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
