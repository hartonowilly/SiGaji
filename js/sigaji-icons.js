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
