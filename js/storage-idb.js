/* SiGaji — penyimpanan lokal besar di IndexedDB (localStorage dibatasi browser ±5 jt karakter per situs). */
(function () {
  var DB_NAME = 'sigaji';
  var STORE = 'kv';
  var openPromise = null;

  function available() {
    try {
      return typeof indexedDB !== 'undefined' && !!indexedDB;
    } catch (e) {
      return false;
    }
  }

  function open() {
    if (openPromise) return openPromise;
    openPromise = new Promise(function (resolve, reject) {
      if (!available()) {
        reject(new Error('IndexedDB tidak tersedia di browser ini'));
        return;
      }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () {
          db.close();
          openPromise = null;
        };
        resolve(db);
      };
      req.onerror = function () {
        reject(req.error || new Error('Gagal membuka IndexedDB'));
      };
    });
    openPromise.catch(function () {
      openPromise = null;
    });
    return openPromise;
  }

  /** Nilai disalin (structured clone) saat put dijalankan, bukan saat dipanggil. */
  function tx(mode, run) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var req = run(t.objectStore(STORE));
        var result;
        req.onsuccess = function () {
          result = req.result;
        };
        t.oncomplete = function () {
          resolve(result);
        };
        t.onerror = function () {
          reject(t.error || req.error);
        };
        t.onabort = function () {
          reject(t.error || new Error('Transaksi IndexedDB dibatalkan'));
        };
      });
    });
  }

  window.sigajiIdb = {
    available: available,
    get: function (key) {
      return tx('readonly', function (s) {
        return s.get(key);
      });
    },
    put: function (key, value) {
      return tx('readwrite', function (s) {
        return s.put(value, key);
      });
    },
    del: function (key) {
      return tx('readwrite', function (s) {
        return s.delete(key);
      });
    },
  };

  if (available()) open().catch(function () {});
})();
