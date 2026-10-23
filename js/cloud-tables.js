/**
 * SiGaji — sinkron ke tabel Supabase (v11) + opsi cadangan blob.
 * Butuh sql/supabase_sigaji_tables_v11.sql + GRANT di supabase_data_api_grants.sql
 *
 * Simpan = hanya baris yang berubah sejak terakhir dimuat/disimpan (js/cloud-delta.js).
 * Hapus  = hanya baris yang dihapus di sesi ini — tidak pernah "hapus semua yang tidak ada di memori".
 */
(function () {
  var TK =
    typeof window.SIGAJI_TENANT_KEY === 'string' && window.SIGAJI_TENANT_KEY.trim()
      ? window.SIGAJI_TENANT_KEY.trim()
      : 'main';

  var D = window.sigajiCloudDelta;
  var STORE_KEYS = D.STORE_KEYS;

  var migratingToTables = false;
  /** Salinan awan yang diketahui sesi ini (dasar perbandingan saat simpan). */
  var base = D.createBase();
  /** Entitas hasil muat terakhir — jadi base hanya setelah payload benar-benar diterapkan ke memori. */
  var loadedEntities = null;
  /** Base sudah mencerminkan awan (muat tabel selesai, atau sengaja dikosongkan setelah muat blob). */
  var baseReady = false;
  var metaWrittenThisSession = false;
  /** Id entitas yang penghapusannya ditolak user (dialog hapus massal) — tidak dikirim lagi sesi ini. */
  var declinedDeletes = Object.create(null);

  var TABLE_OF = {
    K: 'sigaji_karyawan',
    P: 'sigaji_periode',
    S: 'sigaji_store',
    C: 'sigaji_tunj_var_kolom',
    T: 'sigaji_tunj_var_nilai',
  };
  var CONFLICT_OF = {
    K: 'tenant_key,nik',
    P: 'tenant_key,nama',
    S: 'tenant_key,store_key',
    C: 'tenant_key,id',
    T: 'tenant_key,periode_nama,nik,kolom_id',
  };
  var BATCH_OF = { K: 200, P: 100, S: 1, C: 50, T: 500 };
  var V11_TYPES = ['C', 'K', 'P', 'S', 'T'];

  var TUNJ_FULL_PULL_MS = 10 * 60 * 1000;
  var TUNJ_PULL_MARGIN_MS = 10 * 60 * 1000;
  var lastTunjPullAt = 0;
  var lastTunjFullPullAt = 0;

  function storageMode() {
    var m = (window.SIGAJI_STORAGE_MODE || 'dual').toLowerCase();
    if (m === 'blob' || m === 'tables' || m === 'dual') return m;
    return 'dual';
  }

  function isTableMissingError(err) {
    if (!err) return false;
    var b =
      String(err.message || '') +
      String(err.details || '') +
      String(err.hint || '') +
      String(err.code || '');
    return /does not exist|42P01|42883|relation.*not exist|PGRST205/i.test(b);
  }

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function normalizeTunjVarColumns(p) {
    return D.normalizeTunjVarColumns(p || {});
  }

  function buildTunjVarBulanFromRows(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var pn = r.periode_nama;
      var nik = r.nik;
      var kid = r.kolom_id;
      if (!pn || !nik || !kid) return;
      if (!out[pn]) out[pn] = {};
      if (!out[pn][nik]) out[pn][nik] = {};
      out[pn][nik][kid] = Math.round(Number(r.nilai) || 0);
    });
    return out;
  }

  /** Saat pull: cloud = sumber kebenaran, kecuali sel sedang diedit di browser ini. */
  function mergeTunjVarForPull(local, cloud) {
    var out = JSON.parse(JSON.stringify(cloud || {}));
    if (typeof window.sigajiTunjVarCellIsEditing !== 'function') return out;
    Object.keys(local || {}).forEach(function (pn) {
      Object.keys(local[pn] || {}).forEach(function (nik) {
        Object.keys(local[pn][nik] || {}).forEach(function (kid) {
          if (window.sigajiTunjVarCellIsEditing(nik, kid)) {
            if (!out[pn]) out[pn] = {};
            if (!out[pn][nik]) out[pn][nik] = {};
            out[pn][nik][kid] = Math.round(Number(local[pn][nik][kid]) || 0);
          }
        });
      });
    });
    return out;
  }

  /** Sebelum upload: jangan timpa nilai cloud non-zero dengan 0 stale dari sesi lain. */
  function mergeTunjVarBeforeUpload(local, cloud) {
    var out = JSON.parse(JSON.stringify(local || {}));
    Object.keys(cloud || {}).forEach(function (pn) {
      if (!out[pn]) out[pn] = {};
      Object.keys(cloud[pn] || {}).forEach(function (nik) {
        if (!out[pn][nik]) out[pn][nik] = {};
        Object.keys(cloud[pn][nik] || {}).forEach(function (kid) {
          var cv = Math.round(Number(cloud[pn][nik][kid]) || 0);
          var lv = parseFloat(out[pn][nik][kid]);
          if (isNaN(lv)) lv = 0;
          if (cv > 0 && lv === 0) out[pn][nik][kid] = cv;
        });
      });
    });
    return out;
  }

  async function fetchTunjVarRows(sb, sinceIso) {
    var q = sb
      .from('sigaji_tunj_var_nilai')
      .select('periode_nama,nik,kolom_id,nilai')
      .eq('tenant_key', TK);
    if (sinceIso) q = q.gte('updated_at', sinceIso);
    var res = await q;
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function fetchTunjVarBulanFromTables(sb) {
    return buildTunjVarBulanFromRows(await fetchTunjVarRows(sb));
  }

  function forEachBaseOfType(t, fn) {
    base.ids().forEach(function (id) {
      var b = base.get(id);
      if (b && b.t === t) fn(id, b);
    });
  }

  /**
   * Tarik nilai tunjangan variabel dari awan. Biasanya hanya baris yang berubah sejak tarikan terakhir;
   * tiap 10 menit tarik penuh (menangkap sel yang dihapus sesi lain).
   * @returns {Promise<boolean>} true jika memori berubah
   */
  async function pullTunjVarIntoMemory(sb) {
    var ok = await tablesExist(sb);
    if (!ok || typeof tunjVarBulan === 'undefined') return false;
    var now = Date.now();
    var full = !lastTunjPullAt || now - lastTunjFullPullAt > TUNJ_FULL_PULL_MS;
    var sinceIso = full ? null : new Date(lastTunjPullAt - TUNJ_PULL_MARGIN_MS).toISOString();
    var rows = await fetchTunjVarRows(sb, sinceIso);
    lastTunjPullAt = now;
    if (full) lastTunjFullPullAt = now;
    var editing = typeof window.sigajiTunjVarCellIsEditing === 'function' ? window.sigajiTunjVarCellIsEditing : null;

    if (full) {
      var cloud = buildTunjVarBulanFromRows(rows);
      var merged = mergeTunjVarForPull(tunjVarBulan, cloud);
      var before = D.stableStringify(tunjVarBulan);
      tunjVarBulan = merged;
      forEachBaseOfType('T', function (id) {
        base.remove(id);
      });
      rows.forEach(function (r) {
        var e = D.entityFromRow('T', r);
        if (e.data) base.put(e, null);
      });
      return before !== D.stableStringify(merged);
    }

    var changed = false;
    rows.forEach(function (r) {
      var e = D.entityFromRow('T', r);
      if (editing && editing(r.nik, r.kolom_id)) return;
      var byNik = tunjVarBulan[r.periode_nama] && tunjVarBulan[r.periode_nama][r.nik];
      var cur = byNik ? Math.round(Number(byNik[r.kolom_id]) || 0) : 0;
      if (cur !== e.data) {
        D.applyEntityToMemory({ tunjVarBulan: tunjVarBulan }, e, e.data);
        changed = true;
      }
      if (e.data) base.put(e, null);
      else base.remove(e.id);
    });
    return changed;
  }

  /** Dipertahankan untuk kompatibilitas — simpan delta tidak lagi butuh tarik penuh sebelum unggah. */
  async function mergeTunjVarBeforeUploadIntoMemory(sb) {
    var ok = await tablesExist(sb);
    if (!ok) return;
    var cloud = await fetchTunjVarBulanFromTables(sb);
    if (typeof tunjVarBulan !== 'undefined') {
      tunjVarBulan = mergeTunjVarBeforeUpload(tunjVarBulan, cloud);
    }
  }

  function flattenTunjVarBulan(tunjVarBulan) {
    var rows = [];
    var tv = tunjVarBulan || {};
    Object.keys(tv).forEach(function (pn) {
      var byNik = tv[pn] || {};
      Object.keys(byNik).forEach(function (nik) {
        var cols = byNik[nik] || {};
        Object.keys(cols).forEach(function (kid) {
          var v = parseFloat(cols[kid]);
          if (isNaN(v) || v === 0) return;
          rows.push({
            tenant_key: TK,
            periode_nama: pn,
            nik: nik,
            kolom_id: kid,
            nilai: Math.round(v),
          });
        });
      });
    });
    return rows;
  }

  var tablesExistCache = null;
  var tablesExistCacheAt = 0;

  async function tablesExist(sb) {
    var now = Date.now();
    if (tablesExistCache != null && now - tablesExistCacheAt < 60000) {
      return tablesExistCache;
    }
    try {
      var r = await sb.from('sigaji_tenant_meta').select('tenant_key').eq('tenant_key', TK).limit(1);
      tablesExistCache = !r.error;
      tablesExistCacheAt = now;
      return tablesExistCache;
    } catch (e) {
      tablesExistCache = false;
      tablesExistCacheAt = now;
      return false;
    }
  }

  async function loadStoreChunks(sb) {
    var res = await sb.from('sigaji_store').select('store_key,data').eq('tenant_key', TK);
    if (res.error) throw res.error;
    return res.data || [];
  }

  function rememberLoaded(list, t, row) {
    var e = D.entityFromRow(t, row);
    list.push({ e: { t: e.t, key: e.key, nik: e.nik, id: e.id }, j: D.stableStringify(e.data) });
  }

  async function assemblePayloadFromTables(sb) {
    var settled = await Promise.all([
      sb
        .from('sigaji_tenant_meta')
        .select('schema_version,max_employees,plan_label,multi_branch_enabled,max_branches')
        .eq('tenant_key', TK)
        .maybeSingle(),
      sb.from('sigaji_karyawan').select('nik,data').eq('tenant_key', TK),
      sb.from('sigaji_periode').select('nama,data').eq('tenant_key', TK),
      sb
        .from('sigaji_tunj_var_kolom')
        .select('id,nama,sort_order')
        .eq('tenant_key', TK)
        .order('sort_order', { ascending: true }),
      sb
        .from('sigaji_tunj_var_nilai')
        .select('periode_nama,nik,kolom_id,nilai')
        .eq('tenant_key', TK),
      loadStoreChunks(sb),
    ]);
    var meta = settled[0];
    var karRes = settled[1];
    var perRes = settled[2];
    var kolRes = settled[3];
    var nilRes = settled[4];
    var storeRows = settled[5];
    if (meta.error) throw meta.error;
    if (karRes.error) throw karRes.error;
    if (perRes.error) throw perRes.error;
    if (kolRes.error) throw kolRes.error;
    if (nilRes.error) throw nilRes.error;

    var loaded = [];
    var karyawan = (karRes.data || []).map(function (r) {
      var d = r.data && typeof r.data === 'object' ? r.data : {};
      if (!d.nik) d.nik = r.nik;
      rememberLoaded(loaded, 'K', { nik: r.nik, data: d });
      return d;
    });

    var periodes = (perRes.data || []).map(function (r) {
      var d = r.data && typeof r.data === 'object' ? r.data : {};
      if (!d.nama) d.nama = r.nama;
      rememberLoaded(loaded, 'P', { nama: r.nama, data: d });
      return d;
    });

    var tunjVarColumns = (kolRes.data || []).map(function (r) {
      rememberLoaded(loaded, 'C', r);
      return { id: r.id, nama: r.nama || r.id };
    });

    (nilRes.data || []).forEach(function (r) {
      if (Math.round(Number(r.nilai) || 0) !== 0) rememberLoaded(loaded, 'T', r);
    });

    var store = {};
    storeRows.forEach(function (row) {
      store[row.store_key] = row.data;
      if (STORE_KEYS.indexOf(row.store_key) !== -1) rememberLoaded(loaded, 'S', row);
    });

    var licFromMeta = {
      maxEmployees:
        meta.data && meta.data.max_employees != null
          ? parseInt(meta.data.max_employees, 10) || 0
          : 0,
      planLabel: (meta.data && meta.data.plan_label) || '',
      multiBranchEnabled: !!(meta.data && meta.data.multi_branch_enabled),
      maxBranches:
        meta.data && meta.data.max_branches != null
          ? parseInt(meta.data.max_branches, 10) || 1
          : 1,
    };
    /* Hanya baca dari sigaji_tenant_meta (penjual); abaikan salinan license di sigaji_store. */

    var payload = {
      schemaVersion: (meta.data && meta.data.schema_version) || 10,
      license: licFromMeta,
      karyawan: karyawan,
      periodes: periodes,
      hariLibur: store.hariLibur || [],
      masterCuti: store.masterCuti || { kuota: 12, carryover: 'no', cbPotong: true },
      absensi: store.absensi || {},
      lembur: store.lembur || {},
      prorata: store.prorata || {},
      approvals: store.approvals || [],
      notifikasi: store.notifikasi || [],
      perusahaan: store.perusahaan || {},
      users: store.users || [],
      roles: store.roles || {},
      thrManual: store.thrManual || {},
      tunjVarBulan: buildTunjVarBulanFromRows(nilRes.data),
      tunjVarLabels: store.tunjVarLabels || { v1: 'Bonus', v2: 'Uang Makan', v3: 'Lain-lain' },
      tunjVarColumns: tunjVarColumns.length
        ? tunjVarColumns
        : [
            { id: 'v1', nama: 'Bonus' },
            { id: 'v2', nama: 'Uang Makan' },
            { id: 'v3', nama: 'Lain-lain' },
          ],
      karSnapshot: store.karSnapshot || {},
      auditLog: store.auditLog || [],
      bentoLayouts: store.bentoLayouts || {},
      cabang: Array.isArray(store.cabang) ? store.cabang : [],
    };
    loadedEntities = loaded;
    return payload;
  }

  /** Panggil setelah payload hasil muat tabel diterapkan ke memori — sejak itu simpan = delta terhadap data ini. */
  function commitLoadedBase() {
    if (!loadedEntities) return false;
    base.clear();
    loadedEntities.forEach(function (x) {
      base.put(x.e, null, x.j);
    });
    loadedEntities = null;
    declinedDeletes = Object.create(null);
    baseReady = true;
    lastTunjPullAt = Date.now();
    lastTunjFullPullAt = lastTunjPullAt;
    return true;
  }

  /** Data diganti dari blob / mode Karyawan — simpan berikutnya hanya upsert, tanpa hapus. */
  function resetBase() {
    base.clear();
    loadedEntities = null;
    declinedDeletes = Object.create(null);
    baseReady = true;
  }

  /** Logout: tolak unggah tabel sampai data awan dimuat lagi. */
  function forgetBase() {
    resetBase();
    baseReady = false;
  }

  function rowFor(e, ts) {
    switch (e.t) {
      case 'K':
        return { tenant_key: TK, nik: e.key.nik, data: e.data, updated_at: ts };
      case 'P':
        return { tenant_key: TK, nama: e.key.nama, data: e.data, updated_at: ts };
      case 'S':
        return { tenant_key: TK, store_key: e.key.store_key, data: e.data, updated_at: ts };
      case 'C':
        return { tenant_key: TK, id: e.key.id, nama: e.data.nama, sort_order: e.data.sort_order };
      case 'T':
        return {
          tenant_key: TK,
          periode_nama: e.key.periode_nama,
          nik: e.key.nik,
          kolom_id: e.key.kolom_id,
          nilai: e.data,
          updated_at: ts,
        };
      default:
        throw new Error('Jenis entitas tidak dikenal: ' + e.t);
    }
  }

  var MASS_DELETE_LABEL = { K: 'karyawan', P: 'periode gaji', I: 'baris absensi/lembur' };

  async function confirmMassDelete(sus) {
    var msg =
      'Simpan ini akan MENGHAPUS ' +
      sus.n +
      ' dari ' +
      sus.total +
      ' ' +
      (MASS_DELETE_LABEL[sus.t] || 'data') +
      ' di awan. Lanjutkan hanya jika memang disengaja (mis. hapus massal / pulihkan backup). ' +
      'Jika ragu pilih Batal — data lain tetap disimpan, penghapusan tidak dikirim.';
    if (typeof window.sigajiConfirm === 'function') {
      return !!(await window.sigajiConfirm({
        title: 'Konfirmasi hapus data di awan',
        message: msg,
        okText: 'Ya, hapus di awan',
        danger: true,
      }));
    }
    return typeof window.confirm === 'function' ? window.confirm(msg) : false;
  }

  var KEY_COL = { K: 'nik', P: 'nama', S: 'store_key' };
  var STORE_LABEL = {
    perusahaan: 'Profil perusahaan',
    masterCuti: 'Master cuti',
    hariLibur: 'Hari libur',
    users: 'Daftar user',
    roles: 'Hak akses',
    absensi: 'Absensi',
    lembur: 'Lembur',
    prorata: 'Prorata',
    approvals: 'Persetujuan',
    notifikasi: 'Notifikasi',
    thrManual: 'THR manual',
    tunjVarLabels: 'Label tunjangan variabel',
    karSnapshot: 'Snapshot karyawan',
    auditLog: 'Log audit',
    bentoLayouts: 'Tata letak dashboard',
    cabang: 'Cabang',
  };

  function entityLabel(e, data) {
    if (e.t === 'K') {
      var nm = data && data.nama ? String(data.nama) : '';
      return 'Karyawan ' + (nm ? nm + ' (' + e.key.nik + ')' : e.key.nik);
    }
    if (e.t === 'P') return 'Periode ' + e.key.nama;
    if (e.t === 'S') return STORE_LABEL[e.key.store_key] || e.key.store_key;
    return e.id;
  }

  function liveMemory() {
    return typeof window.currentPayloadLite === 'function' ? window.currentPayloadLite() : null;
  }

  async function fetchServerRows(sb, t, keys) {
    var col = KEY_COL[t];
    var out = Object.create(null);
    var parts = chunk(keys, 150);
    for (var i = 0; i < parts.length; i++) {
      var r = await sb.from(TABLE_OF[t]).select(col + ',data').eq('tenant_key', TK).in(col, parts[i]);
      if (r.error) throw r.error;
      (r.data || []).forEach(function (row) {
        out[row[col]] = row.data;
      });
    }
    return out;
  }

  /**
   * Sebelum menulis: baca versi awan baris yang akan diubah/dihapus. Jika berubah sejak base (HRD lain menyimpan),
   * gabung 3 arah — perubahan kedua pihak dipertahankan; memori lokal ikut diperbarui.
   */
  async function reconcileWithServer(sb, plan, useBase) {
    var report = { memoryChanged: false, conflicts: [], kept: [] };
    var mem = liveMemory();
    var types = ['K', 'P', 'S'];
    for (var ti = 0; ti < types.length; ti++) {
      var t = types[ti];
      var ups = plan.upserts.filter(function (u) {
        return u.e.t === t;
      });
      var dels = plan.deletes.filter(function (d) {
        return d.base.t === t;
      });
      if (!ups.length && !dels.length) continue;
      var keys = ups
        .map(function (u) {
          return u.e.key[KEY_COL[t]];
        })
        .concat(
          dels.map(function (d) {
            return d.base.key[KEY_COL[t]];
          })
        );
      var server = await fetchServerRows(sb, t, keys);

      ups.forEach(function (u) {
        var k = u.e.key[KEY_COL[t]];
        var has = Object.prototype.hasOwnProperty.call(server, k);
        var sj = has ? D.stableStringify(server[k]) : null;
        var bj = u.base ? u.base.j : null;
        if (sj === bj) return;
        if (sj === u.j) return;
        var r = D.mergeEntity(bj != null ? JSON.parse(bj) : null, u.e.data, has ? server[k] : null);
        if (r.value == null) return;
        if (r.conflicts.length) {
          report.conflicts.push(entityLabel(u.e, r.value) + ': ' + r.conflicts.slice(0, 4).join(', '));
        }
        var mj = D.stableStringify(r.value);
        if (mj !== u.j) {
          u.e.data = r.value;
          u.j = mj;
          if (mem) D.applyEntityToMemory(mem, u.e, r.value);
          report.memoryChanged = true;
        }
      });

      plan.deletes = plan.deletes.filter(function (d) {
        if (d.base.t !== t) return true;
        var k = d.base.key[KEY_COL[t]];
        if (!Object.prototype.hasOwnProperty.call(server, k)) {
          useBase.remove(d.id);
          return false;
        }
        var sj = D.stableStringify(server[k]);
        if (sj === d.base.j) return true;
        // Diubah pengguna lain sejak dimuat → jangan hapus; tampilkan lagi versi terbaru.
        var e = { t: t, key: d.base.key, nik: d.base.nik, id: d.id };
        if (mem) D.applyEntityToMemory(mem, e, server[k]);
        useBase.put(e, null, sj);
        report.memoryChanged = true;
        report.kept.push(entityLabel(e, server[k]));
        return false;
      });
    }
    return report;
  }

  /**
   * Unggah hanya entitas yang berubah sejak base.
   * @param {object} payload getPayloadForCloud()
   * @param {{base?: object, skipMassDeleteGuard?: boolean}} [opts]
   * @returns {Promise<{upserts: number, deletes: number, storeKeys: string[]}>}
   */
  async function saveDelta(sb, payload, opts) {
    opts = opts || {};
    if (!opts.base && !baseReady) {
      throw new Error('Data awan belum termuat di sesi ini — simpan ke awan ditunda (muat ulang halaman lalu login).');
    }
    var useBase = opts.base || base;
    var ents = D.explodePayload(payload, { items: false });
    var plan = D.planChanges(ents, useBase, V11_TYPES);

    plan.deletes = plan.deletes.filter(function (d) {
      return !declinedDeletes[d.id];
    });
    if (!opts.skipMassDeleteGuard) {
      var sus = D.suspiciousMassDelete(plan, useBase);
      if (sus && !(await confirmMassDelete(sus))) {
        plan.deletes = plan.deletes.filter(function (d) {
          if (d.base.t !== sus.t) return true;
          declinedDeletes[d.id] = true;
          return false;
        });
        if (typeof window.toast === 'function') {
          window.toast('Penghapusan tidak dikirim ke awan. Muat ulang halaman untuk menampilkan lagi data dari awan.');
        }
      }
    }

    var report = { memoryChanged: false, conflicts: [], kept: [] };
    if (!opts.base && (plan.upserts.length || plan.deletes.length)) {
      report = await reconcileWithServer(sb, plan, useBase);
    }

    var ts = new Date().toISOString();
    if (!metaWrittenThisSession && (plan.upserts.length || plan.deletes.length)) {
      var rm = await sb.from('sigaji_tenant_meta').upsert(
        {
          tenant_key: TK,
          schema_version: payload.schemaVersion || 10,
          storage_note: 'tables v11',
          updated_at: ts,
        },
        { onConflict: 'tenant_key' }
      );
      if (rm.error) throw rm.error;
      metaWrittenThisSession = true;
    }

    var byType = {};
    plan.upserts.forEach(function (u) {
      (byType[u.e.t] = byType[u.e.t] || []).push(u);
    });
    for (var ti = 0; ti < V11_TYPES.length; ti++) {
      var t = V11_TYPES[ti];
      var list = byType[t];
      if (!list) continue;
      var parts = chunk(list, BATCH_OF[t]);
      for (var pi = 0; pi < parts.length; pi++) {
        var rows = parts[pi].map(function (u) {
          return rowFor(u.e, ts);
        });
        var r = await sb.from(TABLE_OF[t]).upsert(rows, { onConflict: CONFLICT_OF[t] });
        if (r.error) throw r.error;
        parts[pi].forEach(function (u) {
          useBase.put(u.e, null, u.j);
        });
      }
    }

    await deleteEntities(sb, plan.deletes, useBase);

    return {
      upserts: plan.upserts.length,
      deletes: plan.deletes.length,
      memoryChanged: report.memoryChanged,
      conflicts: report.conflicts,
      kept: report.kept,
      storeKeys: plan.upserts
        .filter(function (u) {
          return u.e.t === 'S';
        })
        .map(function (u) {
          return u.e.key.store_key;
        }),
    };
  }

  async function deleteEntities(sb, deletes, useBase) {
    var byType = {};
    deletes.forEach(function (d) {
      (byType[d.base.t] = byType[d.base.t] || []).push(d);
    });
    var simple = { K: 'nik', P: 'nama', S: 'store_key', C: 'id' };
    var types = Object.keys(simple);
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var list = byType[t];
      if (!list) continue;
      var parts = chunk(list, 100);
      for (var p = 0; p < parts.length; p++) {
        var col = simple[t];
        var vals = parts[p].map(function (d) {
          return d.base.key[col];
        });
        var r = await sb.from(TABLE_OF[t]).delete().eq('tenant_key', TK).in(col, vals);
        if (r.error) throw r.error;
        parts[p].forEach(function (d) {
          useBase.remove(d.id);
        });
      }
    }
    var cells = byType.T || [];
    var groups = {};
    cells.forEach(function (d) {
      var g = d.base.key.periode_nama + '\u0001' + d.base.key.nik;
      (groups[g] = groups[g] || []).push(d);
    });
    var gkeys = Object.keys(groups);
    for (var g = 0; g < gkeys.length; g++) {
      var gl = groups[gkeys[g]];
      var k0 = gl[0].base.key;
      var rt = await sb
        .from('sigaji_tunj_var_nilai')
        .delete()
        .eq('tenant_key', TK)
        .eq('periode_nama', k0.periode_nama)
        .eq('nik', k0.nik)
        .in(
          'kolom_id',
          gl.map(function (d) {
            return d.base.key.kolom_id;
          })
        );
      if (rt.error) throw rt.error;
      gl.forEach(function (d) {
        useBase.remove(d.id);
      });
    }
  }

  /** Unggah penuh tanpa hapus (migrasi blob → tabel kosong). */
  async function savePayloadToTables(sb, payload) {
    await saveDelta(sb, payload, { base: D.createBase(), skipMassDeleteGuard: true });
  }

  async function migrateBlobToTables(sb, blobPayload) {
    if (!blobPayload || typeof blobPayload !== 'object') return false;
    if (migratingToTables) return false;
    migratingToTables = true;
    try {
      await savePayloadToTables(sb, blobPayload);
      return true;
    } finally {
      migratingToTables = false;
    }
  }

  /** Putus koneksi / respons terpotong (mis. "Content-Length … exceeds response Body", HTTP/3 di Firefox). */
  function isTransientNetworkError(e) {
    var m = String((e && (e.message || e.details)) || e || '');
    return /TypeError|NetworkError|Failed to fetch|Load failed|Content-Length|network|ECONNRESET|aborted/i.test(m);
  }

  async function loadFromTables(sb) {
    var attempts = 3;
    for (var i = 1; ; i++) {
      try {
        return await assemblePayloadFromTables(sb);
      } catch (e) {
        if (i >= attempts || !isTransientNetworkError(e)) throw e;
        console.warn('Sigaji: muat tabel terputus, coba lagi (' + i + '/' + (attempts - 1) + ')', e);
        await new Promise(function (r) {
          setTimeout(r, 800 * i);
        });
      }
    }
  }

  /** Baca kuota lisensi dari sigaji_tenant_meta (penjual) — terpisah dari blob sigaji_cloud. */
  async function fetchTenantLicenseMeta(sb) {
    try {
      var ok = await tablesExist(sb);
      if (!ok) return null;
      var meta = await sb
        .from('sigaji_tenant_meta')
        .select('max_employees,plan_label,multi_branch_enabled,max_branches')
        .eq('tenant_key', TK)
        .maybeSingle();
      if (meta.error) throw meta.error;
      if (!meta.data) return { maxEmployees: 0, planLabel: '' };
      return {
        maxEmployees:
          meta.data.max_employees != null ? parseInt(meta.data.max_employees, 10) || 0 : 0,
        planLabel: String(meta.data.plan_label || '').trim(),
        multiBranchEnabled: !!meta.data.multi_branch_enabled,
        maxBranches:
          meta.data.max_branches != null ? parseInt(meta.data.max_branches, 10) || 1 : 1,
      };
    } catch (e) {
      console.warn('Sigaji fetchTenantLicenseMeta:', e);
      return null;
    }
  }

  async function saveToTables(sb, payload) {
    return saveDelta(sb, payload);
  }

  async function tryLoadWithTables(sb, uid, loadBlobFn) {
    var mode = storageMode();
    if (mode === 'blob') return null;

    var ok = await tablesExist(sb);
    if (!ok) {
      console.warn('Sigaji: tabel v11 belum ada — pakai mode blob. Jalankan sql/supabase_sigaji_tables_v11.sql');
      return null;
    }

    try {
      var payload = await loadFromTables(sb);
      var hasKar = (payload.karyawan || []).length > 0;
      var hasPer = (payload.periodes || []).length > 0;
      var kolRes = await sb.from('sigaji_tunj_var_kolom').select('id').eq('tenant_key', TK).limit(1);
      var hasKolom = !kolRes.error && kolRes.data && kolRes.data.length > 0;
      var needsMigrate = !hasKar && !hasPer;
      if (hasKar && hasPer && !hasKolom) needsMigrate = true;

      if (needsMigrate && typeof loadBlobFn === 'function') {
        var blob = await loadBlobFn(uid);
        if (blob && ((blob.karyawan || []).length > 0 || (blob.periodes || []).length > 0)) {
          await migrateBlobToTables(sb, blob);
          payload = await loadFromTables(sb);
        }
      }
      return payload;
    } catch (e) {
      console.error('Sigaji tables load:', e);
      if (isTableMissingError(e)) return null;
      throw e;
    }
  }

  /** Muat data terbatas untuk Karyawan (setelah RLS + sigaji_user_roles). */
  async function tryLoadKaryawanScoped(sb, authUid) {
    if (!authUid) return null;
    var ok = await tablesExist(sb);
    if (!ok) return null;

    var roleRes = await sb
      .from('sigaji_user_roles')
      .select('role,nik')
      .eq('tenant_key', TK)
      .eq('auth_uid', authUid)
      .maybeSingle();
    if (roleRes.error) {
      if (isTableMissingError(roleRes.error)) return null;
      return null;
    }
    if (!roleRes.data) return null;
    if (roleRes.data.role === 'Admin' || roleRes.data.role === 'HRD') return null;
    var nik = roleRes.data.nik ? String(roleRes.data.nik).trim() : '';
    if (!nik) return null;

    var storeKeys = ['perusahaan', 'masterCuti', 'hariLibur', 'notifikasi', 'roles', 'absensi'];
    var parallel = await Promise.all([
      sb.from('sigaji_karyawan').select('data').eq('tenant_key', TK).eq('nik', nik).maybeSingle(),
      sb.from('sigaji_periode').select('data').eq('tenant_key', TK),
      sb.from('sigaji_store').select('store_key,data').eq('tenant_key', TK).in('store_key', storeKeys),
      sb
        .from('sigaji_tunj_var_nilai')
        .select('periode_nama,nik,kolom_id,nilai')
        .eq('tenant_key', TK)
        .eq('nik', nik),
      sb.from('sigaji_tunj_var_kolom').select('id,nama,sort_order').eq('tenant_key', TK),
      sb
        .from('sigaji_tenant_meta')
        .select('max_employees,plan_label,multi_branch_enabled,max_branches')
        .eq('tenant_key', TK)
        .maybeSingle(),
    ]);
    var karRes = parallel[0];
    var perRes = parallel[1];
    var storeRes = parallel[2];
    var nilRes = parallel[3];
    var kolRes = parallel[4];
    var metaRes = parallel[5];
    if (karRes.error) throw karRes.error;
    if (perRes.error) throw perRes.error;
    if (nilRes.error) throw nilRes.error;

    var store = {};
    if (!storeRes.error && storeRes.data) {
      storeRes.data.forEach(function (row) {
        store[row.store_key] = row.data;
      });
    }

    var tunjVarColumns = [];
    if (!kolRes.error && kolRes.data) {
      tunjVarColumns = kolRes.data
        .slice()
        .sort(function (a, b) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        })
        .map(function (c) {
          return { id: c.id, nama: c.nama };
        });
    }

    var absensi = pickOwnAbsensiFromStore(store.absensi || {}, nik);
    var lic = {
      maxEmployees:
        metaRes.data && metaRes.data.max_employees != null
          ? parseInt(metaRes.data.max_employees, 10) || 0
          : 0,
      planLabel: (metaRes.data && metaRes.data.plan_label) || '',
      multiBranchEnabled: !!(metaRes.data && metaRes.data.multi_branch_enabled),
      maxBranches:
        metaRes.data && metaRes.data.max_branches != null
          ? parseInt(metaRes.data.max_branches, 10) || 1
          : 1,
    };

    return {
      schemaVersion: 10,
      license: lic,
      karyawan: karRes.data && karRes.data.data ? [karRes.data.data] : [],
      periodes: (perRes.data || []).map(function (r) {
        return r.data || {};
      }),
      hariLibur: store.hariLibur || [],
      masterCuti: store.masterCuti || { kuota: 12, carryover: 'no', cbPotong: true },
      absensi: absensi,
      lembur: {},
      prorata: {},
      approvals: [],
      notifikasi: store.notifikasi || [],
      perusahaan: store.perusahaan || {},
      users: [],
      roles: store.roles || {},
      thrManual: {},
      tunjVarBulan: buildTunjVarBulanFromRows(nilRes.data),
      tunjVarLabels: { v1: 'Bonus', v2: 'Uang Makan', v3: 'Lain-lain' },
      tunjVarColumns: tunjVarColumns.length
        ? tunjVarColumns
        : [
            { id: 'v1', nama: 'Bonus' },
            { id: 'v2', nama: 'Uang Makan' },
            { id: 'v3', nama: 'Lain-lain' },
          ],
      karSnapshot: {},
      auditLog: [],
      bentoLayouts: {},
      cabang: [],
    };
  }

  function pickOwnAbsensiFromStore(absensi, nik) {
    if (!absensi || !nik || !absensi[nik]) return {};
    var o = {};
    o[nik] = absensi[nik];
    return o;
  }

  /**
   * Simpan ke tabel (delta). Blob sigaji_cloud hanya ditulis bila perlu (lihat shouldWriteBlob di cloud-sync).
   * @param {(res: object|null) => Promise<void>|void} saveBlobFn dipanggil dengan hasil delta (null = tabel tak tersedia)
   */
  async function trySaveWithTables(sb, payload, saveBlobFn) {
    var mode = storageMode();
    if (mode === 'blob') {
      if (typeof saveBlobFn === 'function') await saveBlobFn(null);
      return null;
    }

    var ok = await tablesExist(sb);
    if (!ok) {
      if (typeof saveBlobFn === 'function') await saveBlobFn(null);
      return null;
    }

    var res;
    try {
      res = await saveDelta(sb, payload);
    } catch (e) {
      console.error('Sigaji tables save:', e);
      if (typeof saveBlobFn === 'function') {
        try {
          await saveBlobFn(null);
        } catch (eBlob) {
          console.error('Sigaji blob cadangan:', eBlob);
        }
      }
      throw e;
    }
    if (mode === 'dual' && typeof saveBlobFn === 'function') {
      try {
        await saveBlobFn(res);
      } catch (eBlob) {
        console.warn('Sigaji: tabel tersimpan, cadangan blob gagal', eBlob);
      }
    }
    return res;
  }

  window.sigajiCloudTables = {
    storageMode: storageMode,
    tablesExist: tablesExist,
    loadFromTables: loadFromTables,
    fetchTenantLicenseMeta: fetchTenantLicenseMeta,
    saveToTables: saveToTables,
    saveDelta: saveDelta,
    commitLoadedBase: commitLoadedBase,
    resetBase: resetBase,
    forgetBase: forgetBase,
    isBaseReady: function () {
      return baseReady;
    },
    migrateBlobToTables: migrateBlobToTables,
    tryLoadWithTables: tryLoadWithTables,
    tryLoadKaryawanScoped: tryLoadKaryawanScoped,
    trySaveWithTables: trySaveWithTables,
    flattenTunjVarBulan: flattenTunjVarBulan,
    buildTunjVarBulanFromRows: buildTunjVarBulanFromRows,
    mergeTunjVarForPull: mergeTunjVarForPull,
    mergeTunjVarBeforeUpload: mergeTunjVarBeforeUpload,
    fetchTunjVarBulanFromTables: fetchTunjVarBulanFromTables,
    pullTunjVarIntoMemory: pullTunjVarIntoMemory,
    mergeTunjVarBeforeUploadIntoMemory: mergeTunjVarBeforeUploadIntoMemory,
    normalizeTunjVarColumns: normalizeTunjVarColumns,
    _base: base,
  };
})();
