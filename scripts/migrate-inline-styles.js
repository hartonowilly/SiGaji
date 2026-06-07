/**
 * Migrasi style="..." → class utilities (css/sigaji-utilities.css).
 * Jalankan: node scripts/migrate-inline-styles.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

/** Urutan: exact match style string (normalized) → classes */
const EXACT = {
  'display:none !important': 'u-hidden',
  'display:none': 'u-hidden',
  'display:flex': 'fl',
  'display:block': 'u-block',
  'display:grid': 'u-grid',
  'display:inline-block': 'u-inline-block',
  'flex-wrap:wrap': 'flex-wrap',
  'align-items:center': 'items-center',
  'align-items:flex-start': 'items-start',
  'align-items:flex-end': 'items-end',
  'justify-content:flex-end': 'justify-end',
  'justify-content:space-between': 'justify-between',
  'flex:1': 'flex-1',
  'flex-direction:column': 'flex-col',
  'width:100%': 'w-full',
  'text-align:center': 'text-center',
  'text-align:right': 'text-right',
  'text-align:left': 'text-left',
  'margin:0': 'm-0',
  'margin:0 0 .75rem 0': 'mb-lg',
  'margin:0 0 .5rem 0': 'mb-md',
  'margin:.5rem 0 0': 'mt-md',
  'margin:.45rem 0 0': 'u-note-sm',
  'margin-top:4px': 'mt-xs',
  'margin-top:6px': 'mt-xs',
  'margin-top:8px': 'mt-sm',
  'margin-top:10px': 'mt-sm',
  'margin-top:.35rem': 'mt-sm',
  'margin-top:.45rem': 'mt-sm',
  'margin-top:.5rem': 'mt-md',
  'margin-top:.6rem': 'mt-lg',
  'margin-top:.75rem': 'mt-lg',
  'margin-top:.9rem': 'mt-xl',
  'margin-top:1px': 'mt-xs',
  'margin-top:3px': 'mt-xs',
  'margin-bottom:.35rem': 'mb-sm',
  'margin-bottom:.5rem': 'mb-md',
  'margin-bottom:.6rem': 'mb-md',
  'margin-bottom:.65rem': 'mb-lg',
  'margin-bottom:.75rem': 'mb-lg',
  'margin-bottom:.9rem': 'mb-xl',
  'margin-bottom:0': 'mb-0',
  'margin-bottom:4px': 'mb-xs',
  'margin-bottom:6px': 'mb-xs',
  'margin-bottom:8px': 'mb-sm',
  'margin-left:auto': 'ml-auto',
  'padding:0': 'p-0',
  'padding:.85rem 1rem': 'p-inset',
  'padding:7px 12px': 'p-inset-sm',
  'padding:8px 12px': 'p-inset-xs',
  'padding:10px 14px': 'p-inset-sm',
  'padding:.5rem .6rem': 'p-inset-xs',
  'gap:.5rem': 'gap-sm',
  'gap:.65rem': 'gap-md',
  'gap:5px': 'gap-xs',
  'gap:6px': 'gap-xs',
  'gap:8px': 'gap-sm',
  'gap:.4rem': 'gap-xs',
  'font-size:9px': 'font-9',
  'font-size:10px': 'font-10',
  'font-size:11px': 'font-11',
  'font-size:12px': 'font-12',
  'font-size:13px': 'font-13',
  'font-size:14px': 'font-14',
  'font-size:16px': 'font-16',
  'font-size:17px': 'font-17',
  'font-size:22px': 'font-22',
  'font-weight:600': 'fw-600',
  'font-weight:700': 'fw-700',
  'font-weight:800': 'fw-800',
  'line-height:1.55': 'leading-tight',
  'line-height:1.4': 'leading-snug',
  'line-height:1': 'leading-none',
  'color:#6b7280': 'text-muted',
  'color:#1a56a0': 'text-brand',
  'color:#2d6a0a': 'text-success',
  'color:#9b2121': 'text-danger',
  'color:#7d4800': 'text-warn',
  'color:#5b21b6': 'text-purple',
  'color:#0d3d7a': 'text-blue-dark',
  'color:#1d4ed8': 'text-indigo',
  'color:#374151': 'text-body',
  'color:#9ca3af': 'text-subtle',
  'color:#111827': 'ct-dark',
  'color:#4b5563': 'text-body',
  'background:#fff': 'bg-white',
  'background:#f8fafc': 'bg-surface-2',
  'background:#f8f9fc': 'bg-surface-2',
  'border:0': 'border-0',
  'border-radius:7px': 'rounded-sm',
  'border-radius:8px': 'rounded-sm',
  'border-radius:10px': 'rounded-md',
  'border-radius:20px': 'rounded-pill',
  'overflow:auto': 'overflow-auto',
  'cursor:pointer': 'cursor-pointer',
  'position:relative': 'relative',
  'z-index:5': 'z-5',
  'max-height:260px;overflow:auto': 'max-h-260',
  'max-height:320px;overflow:auto': 'max-h-320',
  'font-size:11px;color:#6b7280': 'u-muted-11',
  'font-size:10px;color:#6b7280': 'u-muted-10',
  'font-size:12px;color:#6b7280': 'u-muted-12',
  'font-size:11px;line-height:1.55': 'u-hint',
  'font-size:11px;line-height:1.65': 'u-hint',
  'font-size:12px;line-height:1.65': 'u-hint-12',
  'font-size:11px;color:#6b7280;margin:.45rem 0 0': 'u-note-sm',
  'font-size:11px;color:#6b7280;margin:.5rem 0 0': 'u-muted-11 mt-md',
  'font-size:10px;color:#6b7280;margin-top:.35rem': 'u-muted-10 mt-sm',
  'font-size:10px;color:#6b7280;margin-top:.45rem': 'u-note-sm',
  'font-size:12px;color:#374151;margin:0 0 .75rem 0': 'font-12 text-body mb-lg',
  'font-size:12px;color:#6b7280': 'u-muted-12',
  'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center': 'fl gap-sm flex-wrap items-center',
  'display:flex;gap:.4rem;flex-wrap:wrap;align-items:center': 'fl gap1 flex-wrap items-center',
  'display:flex;gap:.65rem;flex-wrap:wrap;align-items:center': 'fl gap2 flex-wrap items-center',
  'display:flex;gap:1rem;flex-wrap:wrap;align-items:center': 'fl gap2 flex-wrap items-center',
  'display:flex;gap:.5rem;flex-wrap:wrap': 'fl gap-sm flex-wrap',
  'display:flex;gap:.4rem;flex-wrap:wrap': 'fl gap1 flex-wrap',
  'display:flex;gap:.65rem;flex-wrap:wrap': 'fl gap2 flex-wrap',
  'display:flex;gap:5px;align-items:center': 'fl gap-xs items-center',
  'display:flex;gap:6px;align-items:center': 'fl gap-xs items-center',
  'display:flex;gap:8px;align-items:center': 'fl gap-sm items-center',
  'display:flex;align-items:center;gap:.5rem': 'fl items-center gap-sm',
  'display:flex;align-items:center;gap:.65rem': 'fl items-center gap2',
  'display:flex;align-items:center;gap:7px': 'fl items-center gap-xs',
  'display:flex;align-items:center;gap:8px': 'fl items-center gap-sm',
  'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem':
    'fl-between-wrap',
  'display:flex;justify-content:space-between;align-items:center': 'flb',
  'display:flex;justify-content:space-between;align-items:flex-start': 'fl justify-between items-start',
  'display:flex;justify-content:space-between;font-size:12px;padding:3px 0': 'fl justify-between font-12 py-xs',
  'margin-bottom:.65rem;flex-wrap:wrap;gap:.5rem': 'toolbar-row',
  'margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem': 'toolbar-row mb-lg',
  'margin-bottom:.65rem;justify-content:flex-end': 'toolbar-end',
  'margin:.5rem 0': 'tabs-spaced',
  'margin-bottom:.75rem': 'tabs-spaced-lg',
  'align-items:center': 'items-center',
  'border-left:4px solid #1a56a0': 'border-accent-left',
  'border-left:4px solid #2d6a0a': 'border-accent-success',
  'border-left:4px solid #7d4800': 'border-accent-warn',
  'border-left:4px solid #9b2121': 'border-accent-danger',
  'border-left:4px solid #5b21b6': 'border-accent-purple',
  'border-left:4px solid #2563eb': 'border-accent-indigo',
  'border-left:4px solid #111827': 'border-accent-dark',
  'border-left:4px solid #7c3aed': 'border-accent-purple',
  'background:#f5f0ff;border-color:#c4b5fd': 'card-surface-purple',
  'background:#e8f4de;border-color:#b3d98f': 'card-surface-success',
  'background:#fffbf5;border-color:#f5a623': 'card-surface-warn',
  'background:#f8fafc': 'card-surface-neutral',
  'background:#f5f0ff;border:1.5px solid #c4b5fd;border-radius:10px;padding:.85rem 1rem;margin-bottom:.75rem':
    'card-surface-purple p-inset rounded-md mb-lg border-default',
  'background:#f5f0ff;border:1.5px solid #c4b5fd;border-radius:10px;padding:10px 14px;margin-bottom:.75rem;font-size:12px;color:#5b21b6':
    'card-surface-purple p-inset-sm rounded-md mb-lg font-12 text-purple',
  'background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:8px;padding:8px 12px;margin-bottom:.75rem;font-size:10px;color:#3730a3':
    'card-surface-blue p-inset-xs rounded-sm mb-lg font-10 text-indigo',
  'color:#2d6a0a': 'ct-success',
  'color:#5b21b6': 'ct-purple',
  'color:#7d4800': 'ct-warn',
  'color:#1a56a0': 'ct-brand',
  'color:#1d4ed8': 'ct-indigo',
  'color:#111827': 'ct-dark',
  'color:#9b2121': 'ct-danger',
  'font-size:12px;flex-wrap:wrap': 'font-12 flex-wrap',
  'font-size:12px;color:#6b7280;flex-wrap:wrap': 'u-muted-12 flex-wrap',
  'padding:7px 12px;background:#fff;border-radius:7px;border:1px solid #f5a623': 'pill-warn',
  'padding:7px 12px;background:#fff;border-radius:7px;border:1px solid var(--bd)': 'pill-neutral',
  'margin-top:4px;display:flex;gap:5px;align-items:center': 'pr-input-row',
  'font-size:10px;color:#6b7280': 'u-muted-10',
  'font-size:10px;color:#5b21b6': 'font-10 text-purple',
  'font-size:10px;color:#2d6a0a;font-weight:700': 'font-10 text-success fw-700',
  'font-size:9px;color:#9b2121;font-weight:700': 'font-9 text-danger fw-700',
  'font-size:9px;color:#2d6a0a;font-weight:700': 'font-9 text-success fw-700',
  'font-size:9px;color:#5b21b6': 'font-9 text-purple',
  'font-weight:700;color:#5b21b6': 'fw-700 text-purple',
  'font-weight:700;color:#2d6a0a': 'fw-700 text-success',
  'font-weight:700;color:#1a56a0': 'fw-700 text-brand',
  'font-weight:800;color:#2d6a0a': 'fw-800 text-success',
  'font-weight:800;color:#1a56a0': 'fw-800 text-brand',
  'font-weight:800;color:#5b21b6': 'fw-800 text-purple',
  'font-weight:800;color:#6b7280': 'fw-800 text-muted',
  'font-size:11px;font-weight:700': 'font-11 fw-700',
  'font-size:12px;font-weight:700': 'font-12 fw-700',
  'font-size:13px;font-weight:700': 'font-13 fw-700',
  'font-size:12px;font-weight:700;color:#1a56a0': 'font-12 fw-700 text-brand',
  'font-size:12px;font-weight:700;color:#5b21b6': 'font-12 fw-700 text-purple',
  'font-size:12px;font-weight:700;color:#2d6a0a': 'font-12 fw-700 text-success',
  'font-size:12px;font-weight:700;color:#7d4800': 'font-12 fw-700 text-warn',
  'font-size:12px;font-weight:700;color:#5b21b6;margin-bottom:.35rem': 'font-12 fw-700 text-purple mb-sm',
  'font-size:12px;color:#5b21b6': 'font-12 text-purple',
  'font-size:12px;color:#374151': 'font-12 text-body',
  'font-size:12px;color:#1a56a0': 'font-12 text-brand',
  'font-size:12px;color:#2d6a0a': 'font-12 text-success',
  'font-size:12px;color:#9b2121': 'font-12 text-danger',
  'border-top:4px solid #2d6a0a': 'border-accent-success',
  'border-top:4px solid #5b21b6': 'border-accent-purple',
  'border-top:4px solid #2563eb': 'border-accent-indigo',
  'border-top:4px solid #7c3aed': 'border-accent-purple',
  'border-top:4px solid #111827': 'border-accent-dark',
  'width:auto': 'select-inline',
  'width:auto;padding:5px 10px;border:1.5px solid #dde1e9;font-family:inherit;outline:none':
    'select-inline',
  'width:auto; padding:5px 10px; border:1.5px solid #dde1e9; font-family:inherit; outline:none':
    'select-inline',
  'width:auto;max-width:160px': 'input-time-inline',
  'width:auto;min-width:100px': 'select-inline',
  'min-width:220px': 'min-w-220',
  'min-width:240px': 'input-min-w-240',
  'background:#faf5ff': 'surface-sim-purple',
  'background:#fffbeb': 'surface-sim-amber',
  'background:#eef6ff;border:1px solid #c5d9f5;padding:.65rem 1rem': 'surface-info-light',
  'background:#eef6ff; border:1px solid #c5d9f5; padding:.65rem 1rem': 'surface-info-light rounded-md',
  'border-left:4px solid #b45309': 'border-accent-amber',
  'color:#92400e': 'text-amber-800',
  'margin-bottom:.45rem': 'mb-sm',
  'margin-top:.4rem': 'mt-4px',
  'margin-top:2px': 'mt-2px',
  'font-size:28px': 'font-28',
  'background:#1a56a0;color:#fff': 'btn-email',
  'background:#1a56a0; color:#fff': 'btn-email',
  'background:#229ED9;color:#fff': 'btn-telegram',
  'background:#229ED9; color:#fff': 'btn-telegram',
  'background:#25D366;color:#fff': 'btn-wa',
  'color:#1565a8;margin:.5rem 0 .75rem;padding:.5rem .75rem;background:#e8f4fc;border:1px solid #b8d9f0':
    'slip-tg-hint',
  'color:#1565a8; margin:.5rem 0 .75rem; padding:.5rem .75rem; background:#e8f4fc; border:1px solid #b8d9f0':
    'slip-tg-hint',
  'box-shadow:0 1px 8px rgba(26,86,160,.1)': 'card-shadow-brand',
  'margin-top:.65rem;padding-top:.85rem;border-top:1px solid #eee': 'section-divider-top',
  'background:#e8f0fb;padding:.85rem;border:1px solid #c5d9f5': 'surface-prs-hk',
  'text-transform:uppercase;letter-spacing:.6px': 'label-upper-brand',
  'text-transform:uppercase; letter-spacing:.6px': 'label-upper-brand',
  'padding:8px 14px;border:2px solid #dde1e9': 'hk-radio-label',
  'padding:8px 14px; border:2px solid #dde1e9': 'hk-radio-label',
  'accent-color:#1a56a0;width:16px;height:16px': 'radio-accent',
  'accent-color:#1a56a0;width:16px;height:16px': 'radio-accent',
  'margin:0 0 .5rem': 'mb-md m-0',
  'line-height:1.6': 'leading-tight',
  'border-left:4px solid #2d6a0a;display:none': 'border-accent-success u-hidden',
  'border-left:4px solid #2d6a0a': 'border-accent-success',
  'color:#2d6a0a': 'ct-success',
  'font-size:11px': 'font-11',
  'font-size:11px;line-height:1.65': 'u-hint',
  'align-items:center': 'items-center',
  'margin-bottom:.65rem;flex-wrap:wrap;gap:.5rem': 'toolbar-row',
};

function normStyle(s) {
  return s
    .replace(/\s+/g, '')
    .replace(/;+/g, ';')
    .replace(/^;|;$/g, '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .sort()
    .join(';');
}

function styleToClasses(styleRaw) {
  const raw = styleRaw.trim();
  if (!raw) return { classes: [], remainder: '' };

  const normalized = normStyle(raw);
  if (EXACT[normalized]) {
    return { classes: EXACT[normalized].split(/\s+/).filter(Boolean), remainder: '' };
  }
  if (EXACT[raw]) {
    return { classes: EXACT[raw].split(/\s+/).filter(Boolean), remainder: '' };
  }

  const parts = raw
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const classes = [];
  const unmapped = [];

  for (const part of parts) {
    const key = part.replace(/\s+/g, '');
    let hit = EXACT[part] || EXACT[key];
    if (hit) {
      classes.push(...hit.split(/\s+/));
    } else {
      unmapped.push(part);
    }
  }

  if (unmapped.length === parts.length) {
    return { classes: [], remainder: raw };
  }

  return {
    classes: [...new Set(classes)],
    remainder: unmapped.join('; '),
  };
}

function mergeClassAttr(tag, newClasses) {
  if (!newClasses.length) return tag;
  const cls = [...new Set(newClasses)];
  const m = tag.match(/\sclass=(["'])([^"']*)\1/i);
  if (m) {
    const existing = m[2].split(/\s+/).filter(Boolean);
    const merged = [...new Set([...existing, ...cls])].join(' ');
    return tag.replace(m[0], ` class="${merged}"`);
  }
  return tag.replace(/(<[a-zA-Z][\w:-]*)/, `$1 class="${cls.join(' ')}"`);
}

function migrateContent(content) {
  let changed = 0;
  let kept = 0;

  const out = content.replace(
    /(<[a-zA-Z][^>]*?)\s+style=(["'])([\s\S]*?)\2/gi,
    (full, tagStart, _q, styleVal) => {
      const { classes, remainder } = styleToClasses(styleVal);
      if (!classes.length && remainder) {
        kept++;
        return full;
      }
      let tag = tagStart;
      if (classes.length) {
        tag = mergeClassAttr(tag, classes);
        changed++;
      }
      if (remainder) {
        return `${tag} style="${remainder}"`;
      }
      return tag;
    }
  );

  return { out, changed, kept };
}

const targets = [
  'index.template.html',
  'partials/pg-absensi.html',
  ...fs
    .readdirSync(path.join(root, 'js', 'modules'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join('js', 'modules', f)),
  'js/pesangon.js',
];

let totalChanged = 0;
let totalKept = 0;

for (const rel of targets) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) continue;
  const before = fs.readFileSync(fp, 'utf8');
  const beforeCount = (before.match(/\sstyle=/gi) || []).length;
  const { out, changed, kept } = migrateContent(before);
  const afterCount = (out.match(/\sstyle=/gi) || []).length;
  if (out !== before) {
    fs.writeFileSync(fp, out, 'utf8');
  }
  totalChanged += changed;
  totalKept += kept;
  console.log(`${rel}: style ${beforeCount} → ${afterCount} (mapped ${changed}, kept ${kept})`);
}

console.log(`\nTotal mapped: ${totalChanged}, partial/kept: ${totalKept}`);
