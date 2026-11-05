/**
 * SiGaji — sinkron awan per baris: pecah payload jadi entitas (satu baris tabel Supabase),
 * bandingkan dengan salinan terakhir dari awan (base), dan gabung 3 arah saat bentrok.
 * Murni (tanpa DOM/Supabase) — dipakai cloud-tables.js dan tes Node.
 */
(function (root) {
  /** Kunci store yang punya tabel baris sendiri (sigaji_item) setelah SQL v12. */
  var ITEM_KINDS = ['absensi', 'lembur', 'prorata', 'thrManual', 'karSnapshot', 'hasilGaji', 'absensiPotBaseline'];
  var PAY_PRIVACY_KINDS = { hasilGaji: true, absensiPotBaseline: true };

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
    'gajiTemplates',
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
    gajiTemplates: [],
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
    if (kind === 'thrManual' || kind === 'karSnapshot' || PAY_PRIVACY_KINDS[kind]) return sub + '|' + nik;
    return nik;
  }

  /** Jangan simpan gaji per orang di baris periode (bisa dibaca semua anggota tenant). */
  function sanitizePeriodeForCloud(x) {
    if (!x || typeof x !== 'object') return x;
    var o = {};
    Object.keys(x).forEach(function (k) {
      if (k === 'hasil_gaji' || k === 'absensi_pot_baseline') return;
      o[k] = x[k];
    });
    return o;
  }

  var BASELINE_CACHE_KEYS = { nowTotal: true, nowDetails: true, nowAt: true, dirty: true };
  function sanitizeBaselineForCloud(row) {
    if (!row || typeof row !== 'object') return row;
    var o = {};
    Object.keys(row).forEach(function (k) {
      if (BASELINE_CACHE_KEYS[k]) return;
      o[k] = row[k];
    });
    return o;
  }

  function explodePayPrivacyFromPeriode(x, pushUnique) {
    if (!x || !x.nama) return;
    var pn = String(x.nama);
    var hg = x.hasil_gaji && x.hasil_gaji.byNik;
    if (isPlainObject(hg)) {
      Object.keys(hg).forEach(function (nik) {
        if (hg[nik] == null) return;
        pushUnique(ent('I', { kind: 'hasilGaji', item_key: itemKeyFor('hasilGaji', nik, pn) }, hg[nik], nik));
      });
    }
    var bl = x.absensi_pot_baseline;
    if (isPlainObject(bl)) {
      Object.keys(bl).forEach(function (nik) {
        if (bl[nik] == null) return;
        pushUnique(
          ent(
            'I',
            { kind: 'absensiPotBaseline', item_key: itemKeyFor('absensiPotBaseline', nik, pn) },
            sanitizeBaselineForCloud(bl[nik]),
            nik
          )
        );
      });
    }
  }

  function applyPayPrivacyToPeriode(periodes, kind, pNama, nik, data) {
    if (!pNama || !nik) return;
    var p = null;
    for (var i = 0; i < (periodes || []).length; i++) {
      if (periodes[i] && String(periodes[i].nama) === String(pNama)) {
        p = periodes[i];
        break;
      }
    }
    if (!p) return;
    if (kind === 'hasilGaji') {
      if (data != null && !p.snapshot_locked) return;
      if (!p.hasil_gaji || p.hasil_gaji.v !== 1) p.hasil_gaji = { v: 1, byNik: (p.hasil_gaji && p.hasil_gaji.byNik) || {} };
      if (!p.hasil_gaji.byNik) p.hasil_gaji.byNik = {};
      if (data == null) {
        delete p.hasil_gaji.byNik[nik];
        if (!Object.keys(p.hasil_gaji.byNik).length) delete p.hasil_gaji;
      } else p.hasil_gaji.byNik[nik] = data;
      return;
    }
    if (!p.absensi_pot_baseline) p.absensi_pot_baseline = {};
    if (data == null) {
      delete p.absensi_pot_baseline[nik];
      if (!Object.keys(p.absensi_pot_baseline).length) delete p.absensi_pot_baseline;
    } else p.absensi_pot_baseline[nik] = sanitizeBaselineForCloud(data);
  }

  function mergeByNikMaps(preferred, fallback, onlyNik) {
    var out = {};
    var a = isPlainObject(fallback) ? fallback : {};
    var b = isPlainObject(preferred) ? preferred : {};
    Object.keys(a).forEach(function (k) {
      if (a[k] != null) out[k] = a[k];
    });
    Object.keys(b).forEach(function (k) {
      if (b[k] != null) out[k] = b[k];
    });
    if (onlyNik) {
      if (out[onlyNik] == null) return null;
      var one = {};
      one[onlyNik] = out[onlyNik];
      return one;
    }
    return Object.keys(out).length ? out : null;
  }

  function attachPayPrivacyFromItems(periodes, parts, opts) {
    var hg = (parts && parts.hasilGaji) || {};
    var bl = (parts && parts.absensiPotBaseline) || {};
    var onlyNik = opts && opts.onlyNik ? String(opts.onlyNik) : '';
    (periodes || []).forEach(function (p) {
      if (!p || !p.nama) return;
      var leakedHg = p.hasil_gaji && isPlainObject(p.hasil_gaji.byNik) ? p.hasil_gaji.byNik : null;
      var leakedBl = isPlainObject(p.absensi_pot_baseline) ? p.absensi_pot_baseline : null;
      delete p.hasil_gaji;
      delete p.absensi_pot_baseline;
      var byNik = mergeByNikMaps(hg[p.nama], leakedHg, onlyNik);
      var base = mergeByNikMaps(bl[p.nama], leakedBl, onlyNik);
      if (byNik && p.snapshot_locked) p.hasil_gaji = { v: 1, byNik: byNik };
      if (base) {
        Object.keys(base).forEach(function (nik) {
          base[nik] = sanitizeBaselineForCloud(base[nik]);
        });
        p.absensi_pot_baseline = base;
      }
    });
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

  var dirtyFull = false;
  var dirtyIds = Object.create(null);

  function markDirty(id) {
    if (!id) return;
    dirtyIds[String(id)] = true;
  }
  function markDirtyFull() {
    dirtyFull = true;
  }
  function markDirtyAbsensi(nik, dateIso) {
    if (!nik || !dateIso) return;
    markDirty(entityId('I', { kind: 'absensi', item_key: itemKeyFor('absensi', String(nik), absensiMonthOf(dateIso)) }));
  }
  function markDirtyTunjVar(periodeNama, nik, kolomId) {
    if (!periodeNama || !nik || !kolomId) return;
    markDirty(
      entityId('T', { periode_nama: String(periodeNama), nik: String(nik), kolom_id: String(kolomId) })
    );
  }
  function markDirtyAuditLog() {
    markDirty(entityId('S', { store_key: 'auditLog' }));
  }
  function peekDirty() {
    return { full: dirtyFull, ids: Object.keys(dirtyIds) };
  }
  function hasScopedDirty() {
    return !dirtyFull && Object.keys(dirtyIds).length > 0;
  }
  function clearDirty() {
    dirtyFull = false;
    dirtyIds = Object.create(null);
  }

  function parseEntityId(id) {
    if (!id || id.charAt(1) !== '|') return null;
    var t = id.charAt(0);
    var rest = id.slice(2);
    if (t === 'T') {
      var bits = rest.split('\u0001');
      return { t: 'T', key: { periode_nama: bits[0], nik: bits[1], kolom_id: bits[2] } };
    }
    if (t === 'K') return { t: 'K', key: { nik: rest } };
    if (t === 'P') return { t: 'P', key: { nama: rest } };
    if (t === 'S') return { t: 'S', key: { store_key: rest } };
    if (t === 'C') return { t: 'C', key: { id: rest } };
    if (t === 'I') {
      var cut = rest.indexOf('|');
      if (cut < 0) return null;
      var kind = rest.slice(0, cut);
      var item_key = rest.slice(cut + 1);
      var nik = '';
      if (kind === 'absensi') nik = item_key.slice(0, item_key.lastIndexOf('|'));
      else if (kind === 'lembur' || kind === 'prorata') nik = item_key;
      else nik = item_key.slice(item_key.lastIndexOf('|') + 1);
      return { t: 'I', key: { kind: kind, item_key: item_key }, nik: nik };
    }
    return null;
  }

  function explodeOne(p, id, opts) {
    var parsed = parseEntityId(id);
    if (!parsed) return null;
    opts = opts || {};
    if (parsed.t === 'K') {
      var kar = (p.karyawan || []).find(function (k) {
        return k && String(k.nik) === parsed.key.nik;
      });
      return kar ? ent('K', parsed.key, kar) : null;
    }
    if (parsed.t === 'P') {
      var per = (p.periodes || []).find(function (x) {
        return x && String(x.nama) === parsed.key.nama;
      });
      if (!per) return null;
      return ent('P', parsed.key, sanitizePeriodeForCloud(per));
    }
    if (parsed.t === 'S') {
      var v = p[parsed.key.store_key];
      if (v === undefined) v = STORE_DEFAULTS[parsed.key.store_key];
      return ent('S', parsed.key, v);
    }
    if (parsed.t === 'C') {
      var col = normalizeTunjVarColumns(p).find(function (c) {
        return c.id === parsed.key.id;
      });
      return col ? ent('C', { id: col.id }, { nama: col.nama, sort_order: 0 }) : null;
    }
    if (parsed.t === 'T') {
      var tv = isPlainObject(p.tunjVarBulan) ? p.tunjVarBulan : {};
      var cell = tv[parsed.key.periode_nama] && tv[parsed.key.periode_nama][parsed.key.nik];
      var n = cell ? parseFloat(cell[parsed.key.kolom_id]) : NaN;
      if (isNaN(n) || n === 0) return null;
      return ent('T', parsed.key, Math.round(n));
    }
    if (parsed.t === 'I' && opts.items !== false) {
      var kind = parsed.key.kind;
      var nikI = parsed.nik;
      if (kind === 'hasilGaji' || kind === 'absensiPotBaseline') {
        var pn = parsed.key.item_key.slice(0, parsed.key.item_key.lastIndexOf('|'));
        var per2 = (p.periodes || []).find(function (x) {
          return x && String(x.nama) === pn;
        });
        if (!per2) return null;
        var bag = [];
        explodePayPrivacyFromPeriode(per2, function (e) {
          bag.push(e);
        });
        return (
          bag.filter(function (e) {
            return e.id === id;
          })[0] || null
        );
      }
      var tmp = [];
      var src = {};
      if (kind === 'absensi' || kind === 'lembur' || kind === 'prorata') {
        if (p[kind] && nikI && p[kind][nikI] != null) src[nikI] = p[kind][nikI];
      } else {
        var sub = parsed.key.item_key.slice(0, parsed.key.item_key.lastIndexOf('|'));
        if (p[kind] && p[kind][sub] && nikI) {
          src[sub] = {};
          src[sub][nikI] = p[kind][sub][nikI];
        }
      }
      explodeItems(kind, src, tmp);
      return (
        tmp.filter(function (e) {
          return e.id === id;
        })[0] || null
      );
    }
    return null;
  }

  /** Pecah hanya id yang diminta (klik absensi / sel tunjangan). */
  function explodePayloadIds(p, ids, opts) {
    p = p || {};
    opts = opts || {};
    var out = [];
    var seen = Object.create(null);
    (ids || []).forEach(function (id) {
      if (!id || seen[id]) return;
      var e = explodeOne(p, id, opts);
      if (!e) return;
      seen[e.id] = true;
      out.push(e);
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
      pushUnique(ent('P', { nama: String(x.nama) }, sanitizePeriodeForCloud(x)));
      if (opts.items) explodePayPrivacyFromPeriode(x, pushUnique);
    });
    STORE_KEYS.forEach(function (key) {
      if (opts.items && ITEM_KINDS.indexOf(key) !== -1) return;
      var v = p[key];
      if (v === undefined) v = STORE_DEFAULTS[key];
      if ((key === 'cabang' || key === 'gajiTemplates') && !Array.isArray(v)) v = [];
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
  function planChanges(entities, base, types, opts) {
    var upserts = [];
    var deletes = [];
    var seen = Object.create(null);
    opts = opts || {};
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
    if (opts.partial) {
      (opts.watchIds || []).forEach(function (id) {
        if (seen[id]) return;
        var b = base.get(id);
        if (!b) return;
        if (allow && !allow[b.t]) return;
        deletes.push({ id: id, base: b });
      });
    } else {
      base.ids().forEach(function (id) {
        if (seen[id]) return;
        var b = base.get(id);
        if (allow && !allow[b.t]) return;
        deletes.push({ id: id, base: b });
      });
    }
    return { upserts: upserts, deletes: deletes };
  }

  /** Rencana unggah dari outbox (sudah delta) — jangan menelusuri seluruh memori. */
  function planFromOutbox(entries, base, types) {
    var ents = [];
    var watch = [];
    (entries || []).forEach(function (en) {
      if (!en || !en.id) return;
      watch.push(en.id);
      if (en.d == null) return;
      ents.push({ id: en.id, t: en.t, key: en.key, nik: en.nik, data: en.d });
    });
    return planChanges(ents, base, types, { partial: true, watchIds: watch });
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
    var cands = ['id', 'username', 'kode', 'tgl', 'nik', 'tanggal'];
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
   * Daftar tanpa kunci unik (mis. log audit): gabung sebagai multiset — entri yang ditambah/dihapus
   * sesi ini diterapkan ke versi awan. Tambahan di depan (unshift) tetap di depan.
   */
  function mergeMultiset(base, local, server) {
    function counts(arr) {
      var m = Object.create(null);
      arr.forEach(function (x) {
        var k = stableStringify(x);
        m[k] = (m[k] || 0) + 1;
      });
      return m;
    }
    var cb = counts(base);
    var cl = counts(local);
    var removed = Object.create(null);
    Object.keys(cb).forEach(function (k) {
      var n = cb[k] - (cl[k] || 0);
      if (n > 0) removed[k] = n;
    });
    var addedCount = Object.create(null);
    Object.keys(cl).forEach(function (k) {
      var n = cl[k] - (cb[k] || 0);
      if (n > 0) addedCount[k] = n;
    });
    var front = [];
    var back = [];
    var seenFront = true;
    local.forEach(function (x) {
      var k = stableStringify(x);
      if (addedCount[k] > 0) {
        addedCount[k]--;
        (seenFront ? front : back).push(x);
      } else seenFront = false;
    });
    var kept = server.filter(function (x) {
      var k = stableStringify(x);
      if (removed[k] > 0) {
        removed[k]--;
        return false;
      }
      return true;
    });
    return front.concat(kept, back);
  }

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
    if (Array.isArray(local) && Array.isArray(server) && (Array.isArray(base) || base === MISSING || base == null)) {
      return { value: mergeMultiset(Array.isArray(base) ? base : [], local, server), conflicts: conflicts };
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
        } else {
          var keepHg = i < pl.length ? pl[i].hasil_gaji : null;
          var keepBl = i < pl.length ? pl[i].absensi_pot_baseline : null;
          var nextP = sanitizePeriodeForCloud(data);
          if (i < pl.length) pl[i] = nextP;
          else pl.push(nextP);
          if (keepHg && !nextP.hasil_gaji) nextP.hasil_gaji = keepHg;
          if (keepBl && !nextP.absensi_pot_baseline) nextP.absensi_pot_baseline = keepBl;
        }
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
    if (e.key.kind === 'thrManual' || e.key.kind === 'karSnapshot' || PAY_PRIVACY_KINDS[e.key.kind])
      return ik.slice(0, ik.length - nik.length - 1);
    return '';
  }

  function applyItemToMemory(mem, e, data) {
    var kind = e.key.kind;
    var nik = e.nik != null ? String(e.nik) : '';
    var sub = itemSubKey(e);
    if (PAY_PRIVACY_KINDS[kind] && Array.isArray(mem.periodes)) {
      applyPayPrivacyToPeriode(mem.periodes, kind, sub, nik, data);
    }
    var store = mem[kind];
    if (!isPlainObject(store) || !nik) return;
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
    var parts = {
      absensi: {},
      lembur: {},
      prorata: {},
      thrManual: {},
      karSnapshot: {},
      hasilGaji: {},
      absensiPotBaseline: {},
    };
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
    explodePayloadIds: explodePayloadIds,
    markDirty: markDirty,
    markDirtyFull: markDirtyFull,
    markDirtyAbsensi: markDirtyAbsensi,
    markDirtyTunjVar: markDirtyTunjVar,
    markDirtyAuditLog: markDirtyAuditLog,
    peekDirty: peekDirty,
    hasScopedDirty: hasScopedDirty,
    clearDirty: clearDirty,
    entityFromRow: entityFromRow,
    createBase: createBase,
    planChanges: planChanges,
    planFromOutbox: planFromOutbox,
    suspiciousMassDelete: suspiciousMassDelete,
    merge3: function (b, l, s) {
      return mergeEntity(b, l, s);
    },
    mergeEntity: mergeEntity,
    applyEntityToMemory: applyEntityToMemory,
    itemsToPayloadParts: itemsToPayloadParts,
    sanitizePeriodeForCloud: sanitizePeriodeForCloud,
    attachPayPrivacyFromItems: attachPayPrivacyFromItems,
    sanitizeBaselineForCloud: sanitizeBaselineForCloud,
    normalizeTunjVarColumns: normalizeTunjVarColumns,
  };

  root.sigajiCloudDelta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
