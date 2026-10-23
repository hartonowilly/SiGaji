/**
 * SiGaji — sinkron awan per baris: pecah payload jadi entitas (satu baris tabel Supabase),
 * bandingkan dengan salinan terakhir dari awan (base), dan gabung 3 arah saat bentrok.
 * Murni (tanpa DOM/Supabase) — dipakai cloud-tables.js dan tes Node.
 */
(function (root) {
  /** Kunci store yang punya tabel baris sendiri (sigaji_item) setelah SQL v12. */
  var ITEM_KINDS = ['absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot'];

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
    'bentoLayouts',
    'cabang',
  ];

  var STORE_DEFAULTS = {
    perusahaan: {},
    masterCuti: {},
    hariLibur: [],
    users: [],
    roles: {},
    absensi: {},
    lembur: {},
    prorata: {},
    approvals: [],
    notifikasi: [],
    thrManual: {},
    tunjVarLabels: {},
    karSnapshot: {},
    auditLog: [],
    bentoLayouts: {},
    cabang: [],
  };

  /** JSON dengan kunci terurut — jsonb Postgres mengurutkan ulang kunci, jadi perbandingan harus kanonik. */
  function stableStringify(v) {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'number' && !isFinite(v)) return 'null';
      return v === undefined ? 'null' : JSON.stringify(v);
    }
    if (Array.isArray(v)) {
      var a = '[';
      for (var i = 0; i < v.length; i++) {
        if (i) a += ',';
        var x = v[i];
        a += x === undefined || typeof x === 'function' ? 'null' : stableStringify(x);
      }
      return a + ']';
    }
    if (typeof v.toJSON === 'function') return stableStringify(v.toJSON());
    var keys = Object.keys(v).sort();
    var s = '{';
    var first = true;
    for (var k = 0; k < keys.length; k++) {
      var val = v[keys[k]];
      if (val === undefined || typeof val === 'function') continue;
      if (!first) s += ',';
      first = false;
      s += JSON.stringify(keys[k]) + ':' + stableStringify(val);
    }
    return s + '}';
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function isEmptyValue(v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (isPlainObject(v)) return Object.keys(v).length === 0;
    return false;
  }

  function ent(t, key, data, nik) {
    var e = { t: t, key: key, data: data };
    if (nik != null) e.nik = nik;
    e.id = entityId(t, key);
    return e;
  }

  function entityId(t, key) {
    switch (t) {
      case 'K':
        return 'K|' + key.nik;
      case 'P':
        return 'P|' + key.nama;
      case 'S':
        return 'S|' + key.store_key;
      case 'I':
        return 'I|' + key.kind + '|' + key.item_key;
      case 'T':
        return 'T|' + key.periode_nama + '\u0001' + key.nik + '\u0001' + key.kolom_id;
      case 'C':
        return 'C|' + key.id;
      default:
        throw new Error('Jenis entitas tidak dikenal: ' + t);
    }
  }

  function absensiMonthOf(dateKey) {
    var m = /^(\d{4}-\d{2})/.exec(String(dateKey));
    return m ? m[1] : 'lain';
  }

  function itemKeyFor(kind, nik, sub) {
    if (kind === 'absensi') return nik + '|' + sub;
    if (kind === 'thrManual' || kind === 'karSnapshot') return sub + '|' + nik;
    return nik;
  }

  /** Pecah satu kind (absensi, lembur, …) menjadi entitas sigaji_item. */
  function explodeItems(kind, src, out) {
    if (!isPlainObject(src)) return;
    if (kind === 'absensi') {
      Object.keys(src).forEach(function (nik) {
        var days = src[nik];
        if (!isPlainObject(days)) return;
        var byMonth = {};
        Object.keys(days).forEach(function (d) {
          var v = days[d];
          if (v == null || v === '') return;
          var m = absensiMonthOf(d);
          if (!byMonth[m]) byMonth[m] = {};
          byMonth[m][d] = v;
        });
        Object.keys(byMonth).forEach(function (m) {
          var key = { kind: kind, item_key: itemKeyFor(kind, nik, m) };
          out.push(ent('I', key, byMonth[m], nik));
        });
      });
      return;
    }
    if (kind === 'lembur' || kind === 'prorata') {
      Object.keys(src).forEach(function (nik) {
        var v = src[nik];
        if (isEmptyValue(v)) return;
        out.push(ent('I', { kind: kind, item_key: itemKeyFor(kind, nik) }, v, nik));
      });
      return;
    }
    Object.keys(src).forEach(function (pn) {
      var byNik = src[pn];
      if (!isPlainObject(byNik)) return;
      Object.keys(byNik).forEach(function (nik) {
        var v = byNik[nik];
        if (v == null) return;
        out.push(ent('I', { kind: kind, item_key: itemKeyFor(kind, nik, pn) }, v, nik));
      });
    });
  }

  function normalizeTunjVarColumns(p) {
    var cols = Array.isArray(p.tunjVarColumns) ? p.tunjVarColumns.slice() : [];
    if (!cols.length && isPlainObject(p.tunjVarLabels)) {
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

  /**
   * Payload aplikasi → daftar entitas.
   * @param {object} p payload (getPayloadForCloud)
   * @param {{items?: boolean}} [opts] items: absensi/lembur/… disimpan per baris di sigaji_item
   */
  function explodePayload(p, opts) {
    p = p || {};
    opts = opts || {};
    var out = [];
    var seen = Object.create(null);
    function pushUnique(e) {
      if (seen[e.id]) return;
      seen[e.id] = true;
      out.push(e);
    }
    (Array.isArray(p.karyawan) ? p.karyawan : []).forEach(function (k) {
      if (!k || k.nik == null || String(k.nik).trim() === '') return;
      pushUnique(ent('K', { nik: String(k.nik) }, k));
    });
    (Array.isArray(p.periodes) ? p.periodes : []).forEach(function (x) {
      if (!x || !x.nama) return;
      pushUnique(ent('P', { nama: String(x.nama) }, x));
    });
    STORE_KEYS.forEach(function (key) {
      if (opts.items && ITEM_KINDS.indexOf(key) !== -1) return;
      var v = p[key];
      if (v === undefined) v = STORE_DEFAULTS[key];
      if (key === 'cabang' && !Array.isArray(v)) v = [];
      out.push(ent('S', { store_key: key }, v));
    });
    if (opts.items) {
      ITEM_KINDS.forEach(function (kind) {
        explodeItems(kind, p[kind], out);
      });
    }
    normalizeTunjVarColumns(p).forEach(function (c, idx) {
      out.push(ent('C', { id: c.id }, { nama: c.nama, sort_order: idx }));
    });
    var tv = isPlainObject(p.tunjVarBulan) ? p.tunjVarBulan : {};
    Object.keys(tv).forEach(function (pn) {
      var byNik = tv[pn] || {};
      Object.keys(byNik).forEach(function (nik) {
        var cols = byNik[nik] || {};
        Object.keys(cols).forEach(function (kid) {
          var v = parseFloat(cols[kid]);
          if (isNaN(v) || v === 0) return;
          out.push(ent('T', { periode_nama: pn, nik: nik, kolom_id: kid }, Math.round(v)));
        });
      });
    });
    return out;
  }

  /** Baris tabel awan → entitas (untuk mengisi base setelah muat). */
  function entityFromRow(t, row) {
    switch (t) {
      case 'K': {
        var kd = isPlainObject(row.data) ? row.data : {};
        return ent('K', { nik: String(row.nik) }, kd);
      }
      case 'P': {
        var pd = isPlainObject(row.data) ? row.data : {};
        return ent('P', { nama: String(row.nama) }, pd);
      }
      case 'S':
        return ent('S', { store_key: row.store_key }, row.data);
      case 'I':
        return ent('I', { kind: row.kind, item_key: row.item_key }, row.data, row.nik);
      case 'T':
        return ent(
          'T',
          { periode_nama: row.periode_nama, nik: row.nik, kolom_id: row.kolom_id },
          Math.round(Number(row.nilai) || 0)
        );
      case 'C':
        return ent('C', { id: row.id }, { nama: row.nama || row.id, sort_order: row.sort_order || 0 });
      default:
        throw new Error('Jenis entitas tidak dikenal: ' + t);
    }
  }

  /** Salinan terakhir yang diketahui ada di awan: id → {t, key, nik, j (JSON kanonik), v (versi)}. */
  function createBase() {
    var map = Object.create(null);
    return {
      map: map,
      size: function () {
        return Object.keys(map).length;
      },
      get: function (id) {
        return map[id] || null;
      },
      clear: function () {
        Object.keys(map).forEach(function (k) {
          delete map[k];
        });
      },
      put: function (e, version, json) {
        map[e.id] = {
          t: e.t,
          key: e.key,
          nik: e.nik,
          j: json != null ? json : stableStringify(e.data),
          v: version == null ? null : version,
        };
      },
      remove: function (id) {
        delete map[id];
      },
      ids: function () {
        return Object.keys(map);
      },
    };
  }

  /**
   * Rencana unggah: entitas yang berubah/baru + yang dihapus sejak base.
   * Entitas jenis yang tidak dikelola (types) tidak disentuh — mis. sigaji_item saat SQL v12 belum ada.
   */
  function planChanges(entities, base, types) {
    var upserts = [];
    var deletes = [];
    var seen = Object.create(null);
    var allow = types
      ? types.reduce(function (o, t) {
          o[t] = true;
          return o;
        }, {})
      : null;
    entities.forEach(function (e) {
      if (allow && !allow[e.t]) return;
      seen[e.id] = true;
      var j = stableStringify(e.data);
      var b = base.get(e.id);
      if (!b || b.j !== j) upserts.push({ e: e, j: j, base: b });
    });
    base.ids().forEach(function (id) {
      if (seen[id]) return;
      var b = base.get(id);
      if (allow && !allow[b.t]) return;
      deletes.push({ id: id, base: b });
    });
    return { upserts: upserts, deletes: deletes };
  }

  function countByType(list, pick) {
    var o = {};
    list.forEach(function (x) {
      var t = pick(x);
      o[t] = (o[t] || 0) + 1;
    });
    return o;
  }

  /**
   * Hapus massal mencurigakan (memori terkosongkan karena bug/impor salah)?
   * @returns {{t: string, n: number, total: number}|null}
   */
  function suspiciousMassDelete(plan, base) {
    var dels = countByType(plan.deletes, function (d) {
      return d.base.t;
    });
    var totals = countByType(base.ids(), function (id) {
      return base.get(id).t;
    });
    var watch = ['K', 'P', 'I'];
    for (var i = 0; i < watch.length; i++) {
      var t = watch[i];
      var n = dels[t] || 0;
      var total = totals[t] || 0;
      if (n > 5 && n >= total * 0.3) return { t: t, n: n, total: total };
    }
    return null;
  }

  function deepEqual(a, b) {
    return stableStringify(a) === stableStringify(b);
  }

  function listItemKey(x) {
    if (!isPlainObject(x)) return null;
    var cands = ['id', 'nik', 'username', 'tgl', 'tanggal', 'kode'];
    for (var i = 0; i < cands.length; i++) {
      var v = x[cands[i]];
      if (v != null && v !== '') return cands[i] + ':' + String(v);
    }
    return null;
  }

  function keyedList(arr) {
    if (!Array.isArray(arr)) return null;
    var map = Object.create(null);
    var order = [];
    for (var i = 0; i < arr.length; i++) {
      var k = listItemKey(arr[i]);
      if (k == null || map[k] !== undefined) return null;
      map[k] = arr[i];
      order.push(k);
    }
    return { map: map, order: order };
  }

  var MISSING = { missing: true };

  /**
   * Gabung 3 arah: perubahan lokal (base→local) diterapkan di atas versi awan (server).
   * Bentrok hanya bila field yang sama diubah di dua sisi dengan nilai berbeda — nilai lokal dipakai.
   * @returns {{value: *, conflicts: string[]}}
   */
  function merge3(base, local, server, path, conflicts) {
    path = path || '';
    conflicts = conflicts || [];
    if (deepEqual(local, server)) return { value: local, conflicts: conflicts };
    if (deepEqual(base, local)) return { value: server, conflicts: conflicts };
    if (deepEqual(base, server)) return { value: local, conflicts: conflicts };
    var bObj = base === MISSING ? {} : base;
    if (isPlainObject(local) && isPlainObject(server) && (isPlainObject(bObj) || bObj == null)) {
      bObj = isPlainObject(bObj) ? bObj : {};
      var out = {};
      var keys = Object.keys(Object.assign({}, bObj, local, server));
      keys.forEach(function (k) {
        var hb = Object.prototype.hasOwnProperty.call(bObj, k);
        var hl = Object.prototype.hasOwnProperty.call(local, k);
        var hs = Object.prototype.hasOwnProperty.call(server, k);
        var r = merge3(hb ? bObj[k] : MISSING, hl ? local[k] : MISSING, hs ? server[k] : MISSING, path ? path + '.' + k : k, conflicts);
        if (r.value !== MISSING) out[k] = r.value;
      });
      return { value: out, conflicts: conflicts };
    }
    var kl = keyedList(local);
    var ks = keyedList(server);
    var kb = base === MISSING || base == null ? { map: Object.create(null), order: [] } : keyedList(base);
    if (kl && ks && kb) {
      var merged = Object.create(null);
      var all = Object.keys(Object.assign({}, kb.map, kl.map, ks.map));
      all.forEach(function (k) {
        var r = merge3(
          k in kb.map ? kb.map[k] : MISSING,
          k in kl.map ? kl.map[k] : MISSING,
          k in ks.map ? ks.map[k] : MISSING,
          (path || '') + '[' + k + ']',
          conflicts
        );
        if (r.value !== MISSING) merged[k] = r.value;
      });
      var order = [];
      ks.order.concat(kl.order).forEach(function (k) {
        if (k in merged && order.indexOf(k) === -1) order.push(k);
      });
      return {
        value: order.map(function (k) {
          return merged[k];
        }),
        conflicts: conflicts,
      };
    }
    conflicts.push(path || '(seluruh data)');
    return { value: local, conflicts: conflicts };
  }

  /** Gabung entitas yang bentrok; base/server boleh null (baru dibuat / sudah dihapus). */
  function mergeEntity(baseData, localData, serverData) {
    var b = baseData === undefined || baseData === null ? MISSING : baseData;
    var l = localData === undefined || localData === null ? MISSING : localData;
    var s = serverData === undefined || serverData === null ? MISSING : serverData;
    var r = merge3(b, l, s);
    return { value: r.value === MISSING ? null : r.value, conflicts: r.conflicts };
  }

  /**
   * Terapkan satu entitas (data awan/gabungan) ke memori aplikasi — mutasi di tempat agar referensi tetap valid.
   * @param {object} mem objek dengan referensi hidup (currentPayloadLite())
   * @param {{t:string,key:object,nik?:string}} e
   * @param {*} data null = hapus
   */
  function applyEntityToMemory(mem, e, data) {
    var i;
    switch (e.t) {
      case 'K': {
        var list = mem.karyawan;
        if (!Array.isArray(list)) return;
        for (i = 0; i < list.length; i++) if (list[i] && String(list[i].nik) === e.key.nik) break;
        if (data == null) {
          if (i < list.length) list.splice(i, 1);
        } else if (i < list.length) list[i] = data;
        else list.push(data);
        return;
      }
      case 'P': {
        var pl = mem.periodes;
        if (!Array.isArray(pl)) return;
        for (i = 0; i < pl.length; i++) if (pl[i] && String(pl[i].nama) === e.key.nama) break;
        if (data == null) {
          if (i < pl.length) pl.splice(i, 1);
        } else if (i < pl.length) pl[i] = data;
        else pl.push(data);
        return;
      }
      case 'S': {
        var cur = mem[e.key.store_key];
        var next = data == null ? STORE_DEFAULTS[e.key.store_key] : data;
        replaceInPlace(cur, next);
        return;
      }
      case 'I':
        applyItemToMemory(mem, e, data);
        return;
      case 'T': {
        var tv = mem.tunjVarBulan;
        if (!tv) return;
        var pn = e.key.periode_nama;
        var nik = e.key.nik;
        if (data == null || data === 0) {
          if (tv[pn] && tv[pn][nik]) delete tv[pn][nik][e.key.kolom_id];
          return;
        }
        if (!tv[pn]) tv[pn] = {};
        if (!tv[pn][nik]) tv[pn][nik] = {};
        tv[pn][nik][e.key.kolom_id] = data;
        return;
      }
      case 'C': {
        var cols = mem.tunjVarColumns;
        if (!Array.isArray(cols)) return;
        for (i = 0; i < cols.length; i++) if (cols[i] && cols[i].id === e.key.id) break;
        if (data == null) {
          if (i < cols.length) cols.splice(i, 1);
          return;
        }
        var col = { id: e.key.id, nama: data.nama || e.key.id };
        if (i < cols.length) cols[i] = col;
        else cols.splice(Math.min(data.sort_order || cols.length, cols.length), 0, col);
        return;
      }
      default:
        return;
    }
  }

  function replaceInPlace(cur, next) {
    if (Array.isArray(cur) && Array.isArray(next)) {
      cur.splice.apply(cur, [0, cur.length].concat(next));
      return;
    }
    if (isPlainObject(cur) && isPlainObject(next)) {
      Object.keys(cur).forEach(function (k) {
        delete cur[k];
      });
      Object.assign(cur, next);
    }
  }

  function itemSubKey(e) {
    var ik = String(e.key.item_key);
    var nik = e.nik != null ? String(e.nik) : '';
    if (e.key.kind === 'absensi') return ik.slice(nik.length + 1);
    if (e.key.kind === 'thrManual' || e.key.kind === 'karSnapshot') return ik.slice(0, ik.length - nik.length - 1);
    return '';
  }

  function applyItemToMemory(mem, e, data) {
    var kind = e.key.kind;
    var nik = e.nik != null ? String(e.nik) : '';
    var store = mem[kind];
    if (!isPlainObject(store) || !nik) return;
    var sub = itemSubKey(e);
    if (kind === 'absensi') {
      var days = store[nik] || (store[nik] = {});
      Object.keys(days).forEach(function (d) {
        if (absensiMonthOf(d) === sub) delete days[d];
      });
      if (data && isPlainObject(data)) Object.assign(days, data);
      if (!Object.keys(days).length) delete store[nik];
      return;
    }
    if (kind === 'lembur' || kind === 'prorata') {
      if (data == null) delete store[nik];
      else store[nik] = data;
      return;
    }
    if (data == null) {
      if (store[sub]) {
        delete store[sub][nik];
        if (!Object.keys(store[sub]).length) delete store[sub];
      }
      return;
    }
    if (!isPlainObject(store[sub])) store[sub] = {};
    store[sub][nik] = data;
  }

  /** Susun bagian payload dari baris sigaji_item (saat muat). */
  function itemsToPayloadParts(rows) {
    var parts = { absensi: {}, lembur: {}, prorata: {}, thrManual: {}, karSnapshot: {} };
    (rows || []).forEach(function (row) {
      var e = entityFromRow('I', row);
      if (ITEM_KINDS.indexOf(e.key.kind) === -1) return;
      applyItemToMemory(parts, e, e.data);
    });
    return parts;
  }

  var api = {
    ITEM_KINDS: ITEM_KINDS,
    STORE_KEYS: STORE_KEYS,
    stableStringify: stableStringify,
    entityId: entityId,
    explodePayload: explodePayload,
    entityFromRow: entityFromRow,
    createBase: createBase,
    planChanges: planChanges,
    suspiciousMassDelete: suspiciousMassDelete,
    merge3: function (b, l, s) {
      return mergeEntity(b, l, s);
    },
    mergeEntity: mergeEntity,
    applyEntityToMemory: applyEntityToMemory,
    itemsToPayloadParts: itemsToPayloadParts,
    normalizeTunjVarColumns: normalizeTunjVarColumns,
  };

  root.sigajiCloudDelta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
