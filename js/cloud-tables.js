/**
 * SiGaji — sinkron ke tabel Supabase (v11) + opsi cadangan blob.
 * Butuh sql/supabase_sigaji_tables_v11.sql + GRANT di supabase_data_api_grants.sql
 */
(function () {
  var TK =
    typeof window.SIGAJI_TENANT_KEY === 'string' && window.SIGAJI_TENANT_KEY.trim()
      ? window.SIGAJI_TENANT_KEY.trim()
      : 'main';

  var migratingToTables = false;

  var STORE_KEYS = [
    'perusahaan',
    'masterCuti',
    'hariLibur',
    'users',
    'roles',
    'absensi',
    'lembur',
    'prorata',
    'approvals',
    'notifikasi',
    'thrManual',
    'tunjVarLabels',
    'karSnapshot',
    'auditLog',
  ];

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

  /** Hindari duplikat id kolom (penyebab error 23505 di sigaji_tunj_var_kolom). */
  function normalizeTunjVarColumns(p) {
    var cols = Array.isArray(p.tunjVarColumns) ? p.tunjVarColumns.slice() : [];
    if (!cols.length && p.tunjVarLabels && typeof p.tunjVarLabels === 'object') {
      var L = p.tunjVarLabels;
      cols = [
        { id: 'v1', nama: L.v1 || 'Bonus' },
        { id: 'v2', nama: L.v2 || 'Uang Makan' },
        { id: 'v3', nama: L.v3 || 'Lain-lain' },
      ];
    }
    var seen = {};
    var out = [];
    cols.forEach(function (c) {
      if (!c) return;
      var id = String(c.id || '').trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push({ id: id, nama: String(c.nama || c.id).trim() || id });
    });
    return out;
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

  async function tablesExist(sb) {
    try {
      var r = await sb.from('sigaji_tenant_meta').select('tenant_key').eq('tenant_key', TK).limit(1);
      return !r.error;
    } catch (e) {
      return false;
    }
  }

  async function loadStoreChunks(sb) {
    var res = await sb.from('sigaji_store').select('store_key,data').eq('tenant_key', TK);
    if (res.error) throw res.error;
    var o = {};
    (res.data || []).forEach(function (row) {
      o[row.store_key] = row.data;
    });
    return o;
  }

  async function assemblePayloadFromTables(sb) {
    var meta = await sb
      .from('sigaji_tenant_meta')
      .select('schema_version,max_employees,plan_label')
      .eq('tenant_key', TK)
      .maybeSingle();
    if (meta.error) throw meta.error;

    var karRes = await sb.from('sigaji_karyawan').select('nik,data').eq('tenant_key', TK);
    if (karRes.error) throw karRes.error;

    var perRes = await sb.from('sigaji_periode').select('nama,data').eq('tenant_key', TK);
    if (perRes.error) throw perRes.error;

    var kolRes = await sb
      .from('sigaji_tunj_var_kolom')
      .select('id,nama,sort_order')
      .eq('tenant_key', TK)
      .order('sort_order', { ascending: true });
    if (kolRes.error) throw kolRes.error;

    var nilRes = await sb
      .from('sigaji_tunj_var_nilai')
      .select('periode_nama,nik,kolom_id,nilai')
      .eq('tenant_key', TK);
    if (nilRes.error) throw nilRes.error;

    var store = await loadStoreChunks(sb);

    var karyawan = (karRes.data || []).map(function (r) {
      var d = r.data && typeof r.data === 'object' ? r.data : {};
      if (!d.nik) d.nik = r.nik;
      return d;
    });

    var periodes = (perRes.data || []).map(function (r) {
      var d = r.data && typeof r.data === 'object' ? r.data : {};
      if (!d.nama) d.nama = r.nama;
      return d;
    });

    var tunjVarColumns = (kolRes.data || []).map(function (r) {
      return { id: r.id, nama: r.nama || r.id };
    });

    var licFromMeta = {
      maxEmployees:
        meta.data && meta.data.max_employees != null
          ? parseInt(meta.data.max_employees, 10) || 0
          : 0,
      planLabel: (meta.data && meta.data.plan_label) || '',
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
    };
    return payload;
  }

  async function savePayloadToTables(sb, payload) {
    var ts = new Date().toISOString();
    var p = payload || {};

    /* Kuota lisensi (max_employees, plan_label) hanya penjual — tidak ditulis dari browser. */
    await sb.from('sigaji_tenant_meta').upsert(
      {
        tenant_key: TK,
        schema_version: p.schemaVersion || 10,
        storage_note: 'tables v11',
        updated_at: ts,
      },
      { onConflict: 'tenant_key' }
    );

    var karyawan = Array.isArray(p.karyawan) ? p.karyawan : [];
    var karRows = karyawan
      .filter(function (k) {
        return k && k.nik;
      })
      .map(function (k) {
        return { tenant_key: TK, nik: String(k.nik), data: k, updated_at: ts };
      });

    if (karRows.length) {
      for (var i = 0; i < karRows.length; i += 200) {
        var batch = karRows.slice(i, i + 200);
        var r = await sb.from('sigaji_karyawan').upsert(batch, { onConflict: 'tenant_key,nik' });
        if (r.error) throw r.error;
      }
      var nikSet = karRows.map(function (x) {
        return x.nik;
      });
      var exKar = await sb.from('sigaji_karyawan').select('nik').eq('tenant_key', TK);
      if (!exKar.error && exKar.data && exKar.data.length) {
        var delNik = exKar.data
          .map(function (x) {
            return x.nik;
          })
          .filter(function (nik) {
            return nikSet.indexOf(nik) === -1;
          });
        for (var di = 0; di < delNik.length; di += 100) {
          var dn = delNik.slice(di, di + 100);
          if (dn.length)
            await sb.from('sigaji_karyawan').delete().eq('tenant_key', TK).in('nik', dn);
        }
      }
    }

    var periodes = Array.isArray(p.periodes) ? p.periodes : [];
    var perRows = periodes
      .filter(function (x) {
        return x && x.nama;
      })
      .map(function (x) {
        return { tenant_key: TK, nama: String(x.nama), data: x, updated_at: ts };
      });
    if (perRows.length) {
      var rp = await sb.from('sigaji_periode').upsert(perRows, { onConflict: 'tenant_key,nama' });
      if (rp.error) throw rp.error;
      var namaSet = perRows.map(function (x) {
        return x.nama;
      });
      var exPer = await sb.from('sigaji_periode').select('nama').eq('tenant_key', TK);
      if (!exPer.error && exPer.data && exPer.data.length) {
        var delNama = exPer.data
          .map(function (x) {
            return x.nama;
          })
          .filter(function (nama) {
            return namaSet.indexOf(nama) === -1;
          });
        for (var dp = 0; dp < delNama.length; dp += 100) {
          var dpn = delNama.slice(dp, dp + 100);
          if (dpn.length)
            await sb.from('sigaji_periode').delete().eq('tenant_key', TK).in('nama', dpn);
        }
      }
    }

    var cols = normalizeTunjVarColumns(p);
    if (cols.length) {
      var colRows = cols.map(function (c, idx) {
        return {
          tenant_key: TK,
          id: c.id,
          nama: c.nama,
          sort_order: idx,
        };
      });
      for (var ci = 0; ci < colRows.length; ci += 50) {
        var cb = colRows.slice(ci, ci + 50);
        var rc = await sb.from('sigaji_tunj_var_kolom').upsert(cb, { onConflict: 'tenant_key,id' });
        if (rc.error) throw rc.error;
      }
      var exCol = await sb.from('sigaji_tunj_var_kolom').select('id').eq('tenant_key', TK);
      if (!exCol.error && exCol.data && exCol.data.length) {
        var keepIds = colRows.map(function (x) {
          return x.id;
        });
        var delCol = exCol.data
          .map(function (x) {
            return x.id;
          })
          .filter(function (id) {
            return keepIds.indexOf(id) === -1;
          });
        for (var dc = 0; dc < delCol.length; dc += 50) {
          var dcb = delCol.slice(dc, dc + 50);
          if (dcb.length)
            await sb.from('sigaji_tunj_var_kolom').delete().eq('tenant_key', TK).in('id', dcb);
        }
      }
    }

    var tunjRows = flattenTunjVarBulan(p.tunjVarBulan);
    var periodeNames = Object.keys(p.tunjVarBulan || {});
    if (periodeNames.length) {
      for (var pi = 0; pi < periodeNames.length; pi++) {
        await sb
          .from('sigaji_tunj_var_nilai')
          .delete()
          .eq('tenant_key', TK)
          .eq('periode_nama', periodeNames[pi]);
      }
    }
    if (tunjRows.length) {
      for (var ti = 0; ti < tunjRows.length; ti += 500) {
        var tb = tunjRows.slice(ti, ti + 500);
        var rt = await sb.from('sigaji_tunj_var_nilai').upsert(tb, {
          onConflict: 'tenant_key,periode_nama,nik,kolom_id',
        });
        if (rt.error) throw rt.error;
      }
    }

    var storePayloads = {
      perusahaan: p.perusahaan || {},
      masterCuti: p.masterCuti || {},
      hariLibur: p.hariLibur || [],
      users: p.users || [],
      roles: p.roles || {},
      absensi: p.absensi || {},
      lembur: p.lembur || {},
      prorata: p.prorata || {},
      approvals: p.approvals || [],
      notifikasi: p.notifikasi || [],
      thrManual: p.thrManual || {},
      tunjVarLabels: p.tunjVarLabels || {},
      karSnapshot: p.karSnapshot || {},
      auditLog: p.auditLog || [],
    };

    for (var si = 0; si < STORE_KEYS.length; si++) {
      var key = STORE_KEYS[si];
      var data = storePayloads[key];
      if (data === undefined) continue;
      var rs = await sb.from('sigaji_store').upsert(
        { tenant_key: TK, store_key: key, data: data, updated_at: ts },
        { onConflict: 'tenant_key,store_key' }
      );
      if (rs.error) throw rs.error;
    }
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

  async function loadFromTables(sb) {
    return assemblePayloadFromTables(sb);
  }

  /** Baca kuota lisensi dari sigaji_tenant_meta (penjual) — terpisah dari blob sigaji_cloud. */
  async function fetchTenantLicenseMeta(sb) {
    try {
      var ok = await tablesExist(sb);
      if (!ok) return null;
      var meta = await sb
        .from('sigaji_tenant_meta')
        .select('max_employees,plan_label')
        .eq('tenant_key', TK)
        .maybeSingle();
      if (meta.error) throw meta.error;
      if (!meta.data) return { maxEmployees: 0, planLabel: '' };
      return {
        maxEmployees:
          meta.data.max_employees != null ? parseInt(meta.data.max_employees, 10) || 0 : 0,
        planLabel: String(meta.data.plan_label || '').trim(),
      };
    } catch (e) {
      console.warn('Sigaji fetchTenantLicenseMeta:', e);
      return null;
    }
  }

  async function saveToTables(sb, payload) {
    await savePayloadToTables(sb, payload);
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

  async function trySaveWithTables(sb, payload, saveBlobFn) {
    var mode = storageMode();
    if (mode === 'blob') {
      if (typeof saveBlobFn === 'function') await saveBlobFn();
      return;
    }

    var ok = await tablesExist(sb);
    if (!ok) {
      if (typeof saveBlobFn === 'function') await saveBlobFn();
      return;
    }

    try {
      await saveToTables(sb, payload);
      if (mode === 'dual' && typeof saveBlobFn === 'function') await saveBlobFn();
    } catch (e) {
      console.error('Sigaji tables save:', e);
      if (typeof saveBlobFn === 'function') await saveBlobFn();
    }
  }

  window.sigajiCloudTables = {
    storageMode: storageMode,
    tablesExist: tablesExist,
    loadFromTables: loadFromTables,
    fetchTenantLicenseMeta: fetchTenantLicenseMeta,
    saveToTables: saveToTables,
    migrateBlobToTables: migrateBlobToTables,
    tryLoadWithTables: tryLoadWithTables,
    trySaveWithTables: trySaveWithTables,
    flattenTunjVarBulan: flattenTunjVarBulan,
    buildTunjVarBulanFromRows: buildTunjVarBulanFromRows,
  };
})();
