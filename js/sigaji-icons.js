/** SVG nav icons — ganti emoji di sidebar */
function sigajiNavIcon(id) {
  var s = 'stroke="currentColor" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  var icons = {
    dashboard:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1" ' +
      s +
      '/><rect x="14" y="3" width="7" height="5" rx="1" ' +
      s +
      '/><rect x="14" y="12" width="7" height="9" rx="1" ' +
      s +
      '/><rect x="3" y="16" width="7" height="5" rx="1" ' +
      s +
      '/></svg>',
    notifikasi:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" ' +
      s +
      '/><path d="M13.73 21a2 2 0 01-3.46 0" ' +
      s +
      '/></svg>',
    karyawan:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" ' +
      s +
      '/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" ' +
      s +
      '/></svg>',
    absensi:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ' +
      s +
      '/><path d="M16 2v4M8 2v4M3 10h18" ' +
      s +
      '/></svg>',
    kompgaji:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" ' +
      s +
      '/><circle cx="12" cy="12" r="2" ' +
      s +
      '/></svg>',
    lembur:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" ' +
      s +
      '/><path d="M12 7v5l3 2" ' +
      s +
      '/></svg>',
    thr:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v8H4v-8" ' +
      s +
      '/><path d="M12 3v9M8.5 8.5L12 12l3.5-3.5M2 12h20" ' +
      s +
      '/></svg>',
    pesangon:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 8h14M7 21h10" ' +
      s +
      '/></svg>',
    penggajian:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6" ' +
      s +
      '/></svg>',
    simulasi:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8" ' +
      s +
      '/><path d="M14 7h7v7" ' +
      s +
      '/></svg>',
    slip:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" ' +
      s +
      '/><path d="M14 2v6h6M8 13h8M8 17h8" ' +
      s +
      '/></svg>',
    laporan:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16M8 19v-6M12 19V9M16 19v-3" ' +
      s +
      '/></svg>',
    master:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" ' +
      s +
      '/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" ' +
      s +
      '/></svg>',
    backup:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="8" ry="3" ' +
      s +
      '/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" ' +
      s +
      '/></svg>',
    users:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" ' +
      s +
      '/><path d="M2 20c0-3.5 3-5 7-5M15 11a3 3 0 100-6 3 3 0 000 6zM14 20c0-2.5 2-4 5-4" ' +
      s +
      '/></svg>',
    myslip:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" ' +
      s +
      '/><rect x="9" y="3" width="6" height="4" rx="1" ' +
      s +
      '/></svg>',
    mycuti:
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" ' +
      s +
      '/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" ' +
      s +
      '/></svg>',
  };
  return icons[id] || '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2" ' + s + '/></svg>';
}

/** Emoji lama (menu, tab, kosong) → ikon garis yang sama dengan sidebar. */
var SIGAJI_LEGACY_ICON = [
  ['\uD83D\uDC64', 'karyawan'],
  ['\uD83D\uDC65', 'users'],
  ['\uD83D\uDCC5', 'absensi'],
  ['\uD83D\uDCB0', 'penggajian'],
  ['\uD83D\uDCB2', 'kompgaji'],
  ['\u23F3', 'lembur'],
  ['\uD83C\uDF81', 'thr'],
  ['\u2696', 'pesangon'],
  ['\uD83D\uDCCA', 'simulasi'],
  ['\uD83D\uDCC8', 'simulasi'],
  ['\uD83D\uDCCB', 'slip'],
  ['\uD83D\uDCD2', 'slip'],
  ['\uD83D\uDCC4', 'laporan'],
  ['\u2699', 'master'],
  ['\uD83D\uDCBE', 'backup'],
  ['\uD83C\uDF1E', 'mycuti'],
  ['\uD83D\uDD14', 'notifikasi'],
  ['\uD83C\uDFE2', 'master'],
  ['\uD83C\uDFE6', 'penggajian'],
  ['\uD83C\uDFE8', 'absensi'],
  ['\uD83D\uDCCD', 'absensi'],
  ['\uD83D\uDCDD', 'laporan'],
  ['\uD83D\uDCE5', 'backup'],
  ['\uD83D\uDCE8', 'slip'],
  ['\uD83D\uDCD1', 'master'],
  ['\uD83D\uDD10', 'users'],
  ['\uD83D\uDCF7', 'karyawan'],
  ['\uD83D\uDCF1', 'myslip'],
  ['\uD83D\uDCF2', 'myslip'],
  ['\u270E', 'master'],
  ['\u2709', 'slip'],
  ['\u2705', 'users'],
  ['\u26A0', 'pesangon'],
  ['\uD83D\uDD04', 'master']
];

function sigajiReplaceLegacyIcons(html) {
  var s = String(html || '');
  if (!s) return s;
  s = s.replace(/&#(\d+);/g, function (_, n) {
    var cp = parseInt(n, 10);
    if (!cp) return _;
    if (cp > 0xffff) {
      var u = cp - 0x10000;
      return String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
    return String.fromCharCode(cp);
  });
  s = s.replace(/\uFE0F/g, '');
  SIGAJI_LEGACY_ICON.forEach(function (pair) {
    if (s.indexOf(pair[0]) >= 0) s = s.split(pair[0]).join(sigajiNavIcon(pair[1]));
  });
  return s;
}

function sigajiSvgNode(id) {
  var parsed = new DOMParser().parseFromString(sigajiNavIcon(id), 'image/svg+xml');
  var svg = parsed.documentElement;
  if (!svg || svg.tagName.toLowerCase() === 'parsererror') return document.createTextNode('');
  return document.importNode(svg, true);
}

function sigajiReplaceOneEmoji(textNode) {
  var value = String(textNode.nodeValue || '').replace(/\uFE0F/g, '');
  var hit = null;
  var at = -1;
  SIGAJI_LEGACY_ICON.forEach(function (pair) {
    var i = value.indexOf(pair[0]);
    if (i >= 0 && (at < 0 || i < at)) {
      at = i;
      hit = pair;
    }
  });
  if (!hit || !textNode.parentNode) return false;
  var parent = textNode.parentNode;
  var before = value.slice(0, at);
  var after = value.slice(at + hit[0].length);
  if (before) parent.insertBefore(document.createTextNode(before), textNode);
  parent.insertBefore(sigajiSvgNode(hit[1]), textNode);
  textNode.nodeValue = after;
  return true;
}

function sigajiDressChromeIcons(root) {
  var scope = root && root.querySelectorAll ? root : document;
  var nodes = scope.querySelectorAll(
    '.tab, .pt, .ct, .periode-pill, .notif-btn, .page-actions .btn, .dash-bento-toolbar .btn, .sigaji-empty-icon, .label-upper-brand'
  );
  nodes.forEach(function (el) {
    if (el.dataset && el.dataset.icoDressed === '1') return;
    var changed = false;
    var guard = 0;
    while (guard++ < 12) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      var step = false;
      for (var i = 0; i < texts.length; i++) {
        if (sigajiReplaceOneEmoji(texts[i])) {
          step = true;
          changed = true;
          break;
        }
      }
      if (!step) break;
    }
    if (changed && el.dataset) el.dataset.icoDressed = '1';
  });
}

function sigajiBindPageMore() {
  if (window.__sigajiPageMoreBound) return;
  window.__sigajiPageMoreBound = true;
  document.addEventListener('click', function (e) {
    var picked = e.target && e.target.closest ? e.target.closest('.page-more-menu button, .page-more-menu .btn') : null;
    if (picked) {
      var host = picked.closest('details.page-more');
      if (host) host.removeAttribute('open');
    }
    document.querySelectorAll('details.page-more[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    sigajiDressChromeIcons();
    sigajiBindPageMore();
  });
} else {
  sigajiDressChromeIcons();
  sigajiBindPageMore();
}
