/**
 * Deklarasi global SiGaji untuk // @ts-check di app-core.js (tanpa rewrite ke TypeScript).
 * Juga dipakai typecheck:payroll (constants.js + ptkp.js).
 */
declare var perusahaan: {
  nama?: string;
  npwp?: string;
  /** NITKU 6 digit TKU (e-Bupot). */
  nitku?: string;
  alamat?: string;
  telp?: string;
  email?: string;
  logo?: string;
  /** Warna aksen tema "Warna PT" (hex). */
  brand_color?: string;
  web?: string;
  jamMasuk?: string;
  jamPulang?: string;
  /** Nomor urut 1721-A1 terakhir per tahun pajak, mis. { "2026": 12 }. */
  a1_seq?: Record<string, number>;
  a1_prefix?: string;
  a1_kota?: string;
  a1_ttd_nama?: string;
  a1_ttd_jabatan?: string;
  converter_bank?: Record<string, unknown>;
  hariKerja?: number;
  ter_custom?: Record<string, number[]>;
  ptkp_nilai?: Record<string, number>;
  /** UMK per tahun, mis. { "2026": 5000000 }. */
  umk?: Record<string, Rupiah>;
  aturan_potongan?: Record<string, { mode?: string; nilai?: number }>;
  koreksi_absensi_otomatis?: boolean;
};

interface Periode {
  id: number | string;
  nama: string;
  start: string;
  end: string;
  bayar: string;
  status: string;
  thr_aktif?: boolean;
  thr_nama?: string;
  thr_bayar?: string;
  thr_hariraya?: string;
  tipe_periode?: string;
  opsi_lebih_bayar?: string;
  snapshot_locked?: boolean;
  /** Rekap gross/PPh/neto saat dikunci — laporan tidak perlu muat absensi arsip. */
  arsip_rekap?: { v: number; kar: number; gross: number; thr: number; pph: number; neto: number; at: string };
  absensi_pot_baseline?: Record<string, { total: number; details?: unknown[]; settledAt?: string; capturedAt?: string }>;
}

/** SheetJS (CDN) — tanpa tipe resmi di proyek ini. */
declare var XLSX: any;

/**
 * Modul lama membaca getElementById(...).value / .checked langsung.
 * Dilonggarkan di sini; modul payroll inti tetap cast ke HTMLInputElement.
 */
interface HTMLElement {
  value?: any;
  checked?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  alt?: string;
  placeholder?: string;
  type?: string;
  autocomplete?: string;
}

/** Nilai rupiah: number di memori; data impor/backup lama bisa berupa teks — selalu lewat sigajiRp(). */
type Rupiah = number | string;

/** Salinan komponen gaji karyawan untuk satu periode (karSnapshot[periode][nik]). */
interface KarSnapshot {
  /** Diisi saat snapshot dipakai sebagai target edit panel payroll. */
  nik?: string;
  nama?: string;
  gapok?: Rupiah;
  siklus_gaji?: string;
  hari_gaji?: number;
  tunjangan?: KaryawanPayroll['tunjangan'];
  potongan?: KaryawanPayroll['potongan'];
  natura?: KaryawanPayroll['natura'];
  bpjs_aktif?: Record<string, boolean>;
  bpjs_manual?: Record<string, Rupiah>;
  pph_return?: { nilai?: Rupiah; ket?: string };
  cabangId?: string;
}

interface ProrataEntry {
  enabled?: boolean;
  hk?: number;
  hh?: number;
  manual?: boolean;
  /** Diaktifkan otomatis karena karyawan berhenti di periode ini. */
  autoResign?: boolean;
  /** User mematikan prorata resign secara manual — jangan dinyalakan ulang otomatis. */
  resignPrOff?: boolean;
}

declare var periodes: Periode[];
declare var hariLibur: Array<{ tgl: string; nama?: string; tipe?: string }>;
declare var masterCuti: { cbPotong?: boolean; kuota?: number; carryover?: string };
declare var absensi: Record<string, Record<string, string>>;
declare var prorata: Record<string, Record<string, ProrataEntry>>;
declare var thrManual: Record<string, Record<string, { aktif?: boolean; nilai?: Rupiah }>>;
declare var lembur: Record<string, Array<{ tanggal?: string; jam?: string | number }>>;
declare var karSnapshot: Record<string, Record<string, KarSnapshot>>;
declare var karyawan: KaryawanPayroll[];
declare var tunjVarBulan: Record<string, Record<string, Record<string, Rupiah>>>;
declare var tunjVarLabels: Record<string, string>;
declare var tunjVarColumns: Array<{ id: string; nama?: string }>;
declare var approvals: Array<Record<string, any>>;
declare var auditLog: Array<Record<string, any>>;
/** NIK karyawan yang sedang dibuka di panel payroll. */
declare var cpNik: string | null;

declare var CU: SigajiUser | null | undefined;

declare function sigajiCatchWarn(where: string, err: unknown): void;
declare function sigajiSortKaryawanByNik(list: KaryawanPayroll[]): KaryawanPayroll[];
declare function sigajiNextNik(list: KaryawanPayroll[]): string;
declare function sigajiFilterKaryawanByCabang(list: KaryawanPayroll[]): KaryawanPayroll[];
declare function sigajiKarCabangId(k: KaryawanPayroll): string;
declare function sigajiShowEl(el: HTMLElement | null, display?: string): void;
declare function sigajiHideEl(el: HTMLElement | null): void;
declare function sigajiIsPanelVisible(el: HTMLElement | null): boolean;
declare function renderTunjPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function renderPotPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function loadBPJSPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function renderNaturaPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function renderPPhRetPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function updateGajiSummary(): void;
declare function sigajiMultiBranchEnabled(): boolean;
declare function sigajiKarCabangPemotongMeta(k: KaryawanPayroll): {
  nama?: string;
  npwp?: string;
  nitku?: string;
  alamat?: string;
  cabangNama?: string;
  cabangId?: string;
  npwpRaw?: string;
  /** ID TKU 22 digit (NPWP16 + NITKU). */
  idTku22?: string;
  a1_kota?: string;
  a1_ttd_nama?: string;
  a1_ttd_jabatan?: string;
};
declare function sigajiSetPanelVisible(el: HTMLElement | null, on: boolean, display?: string): void;
declare function sigajiSetTbodyRows(tbody: HTMLElement | null, rows: string[], chunkSize?: number): void;
declare function sigajiWithSkeleton(target: Element | string, colspan: number, run: () => unknown): unknown;
declare function sigajiNormalizeKarTipe(v?: string, k?: KaryawanPayroll): string;
declare function renderSlipSendBatchChecklist(): void;
/** @returns posisi Y setelah sampul */
declare function sigajiPdfMagazineCover(doc: any, opts?: Record<string, unknown>): number;
declare function sigajiPdfMagazineFooter(doc: any, pageNum: number): void;
declare function sigajiKarOptionsHtml(list: KaryawanPayroll[], emptyLabel?: string): string;
declare function sigajiDataAction(action: string, data?: Record<string, unknown>): string;
declare function sigajiEmptyState(opts: Record<string, unknown> | string): string;
declare function populateSelects(): void;
declare function sigajiNormalizeSiklusGaji(v?: string): string;
declare function sigajiSiklusGajiSortRank(v?: string): number;
declare function normalizeHariGaji(v?: string | number): number;
declare function siklusBpjsUpahSebulan(siklus: string, rate: number, hariKerja?: number): number;
declare function siklusBuildPays(
  k: KaryawanPayroll,
  p: { start?: string; end?: string; bayar?: string },
  hariKerja: number,
  libur: Record<string, boolean>,
  absensi?: Record<string, string>
): Array<{ tgl: string; upah: number; parsial?: boolean }>;
declare function pecahPotonganCadangan(
  pays: Array<{ tgl: string; upah: number }>,
  totalPot: number
): {
  items: Array<{ tgl: string; upah: number; potongan: number; dibayar: number; parsial?: boolean }>;
  sisaPotongan: number;
};
declare function liburSetFrom(list: unknown): Record<string, boolean>;
declare function saveAll(): void;
declare function toast(msg: string): void;
/** True bila data periode sudah di memori; jika belum, mulai muat arsip. */
declare function sigajiNeedPeriodeData(pNama: string): boolean;
declare function sigajiPeriodeDataReady(pNama: string, nik?: string): boolean;
declare function openModal(id: string): void;
declare function closeModal(id: string): void;
declare function escapeHtml(s: unknown): string;
declare function escapeAttr(s: unknown): string;
declare function karyawanSortedAll(): Array<Record<string, unknown>>;
declare function renderKar(): void;
declare function renderPenggajian(): void;
declare function renderPPH(): void;
declare function updatePTKPVal(): void;
/** Data PHK / resign di karyawan (k.phk). Nilai override bisa teks dari impor — baca via sigajiRp. */
interface PhkData {
  alasan?: string;
  sisa_cuti_hari?: number | string;
  up_manual?: Rupiah;
  upmk_manual?: Rupiah;
  uph_manual?: Rupiah;
  uph_tambahan?: Rupiah;
  pisah?: Rupiah;
  keterangan?: string;
}
interface HasilPesangon {
  ok: boolean;
  pesan?: string;
  /** Upah dasar pesangon (gapok + tunjangan tetap). */
  dasar: number;
  /** Masa kerja (bulan). */
  mk: number;
  bUp: number;
  bUpmk: number;
  up: number;
  upmk: number;
  uph: number;
  pisah: number;
  total: number;
  sisaCuti: number;
  sisaCutiAuto: number;
  uphCuti?: number;
  opt: { f?: number | null; uphOnly?: boolean; manual?: boolean; [key: string]: unknown } | null;
  faktor?: number | null;
}
declare function hitungPesangon(k: KaryawanPayroll): HasilPesangon;

interface SigajiUser {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  nama?: string;
  nik?: string | null;
  aktif?: boolean;
  cabangId?: string;
}
interface Cabang {
  id: string;
  nama: string;
  kode?: string;
  npwp?: string;
  nitku?: string;
  alamat?: string;
  umk?: Rupiah;
  aktif?: boolean;
}
declare var users: SigajiUser[];
/** Hak akses: nama role → daftar id modul. */
declare var roles: Record<string, string[]>;
declare var cabang: Cabang[];
declare var notifikasi: Array<Record<string, any>>;
declare var tenantLicense: { maxEmployees: number; planLabel: string; multiBranchEnabled: boolean; maxBranches: number };
declare var bmState: Record<string, any>;
declare const DB_KEY: string;

/**
 * Kode UI lama mengakses properti elemen hasil querySelector tanpa cast.
 * Dilonggarkan untuk properti DOM umum saja; nama properti lain tetap dicek.
 */
interface Element {
  style: CSSStyleDeclaration;
  dataset: DOMStringMap;
  value?: any;
  checked?: boolean;
  disabled?: boolean;
  src?: string;
  options?: HTMLOptionsCollection;
  selectedIndex?: number;
  files?: FileList | null;
  focus(): void;
  click(): void;
  blur(): void;
}

interface SigajiIdbStore {
  available(): boolean;
  get(key: string): Promise<any>;
  put(key: string, value: unknown): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

interface Window {
  /** Fungsi diekspor ke window untuk onclick / modul lain (script tag tanpa bundler). */
  [key: string]: any;
  SIGAJI_CLOUD_ONLY_MODE?: boolean;
  sigajiIdb?: SigajiIdbStore;
  getPTKPTable?: Function;
  nilaiPTKP?: Function;
  fmtPTKPVal?: Function;
  isJkPerempuan?: Function;
  isSigajiAdminUser?: Function;
  canEditPtkpStatus?: Function;
  applyPtkpFieldState?: Function;
  togglePtkpFemaleOverride?: Function;
  onJkChange?: Function;
  openPtkpJanuariModal?: Function;
  simpanPtkpJanuari?: Function;
  isNamaPeriodeJanuari?: Function;
}

/** Hasil hitungGaji — field utama untuk slip & laporan. */
interface HitungGajiResult {
  gapokEff: number;
  gapokFull: number;
  gapokRate?: number;
  siklusGaji?: string;
  siklusUnits?: number;
  gapokBpjs?: number;
  jadwalBayar?: {
    items: Array<{ tgl: string; upah: number; potongan: number; dibayar: number; parsial?: boolean }>;
    sisaPotongan: number;
  } | null;
  grossPPh: number;
  brutoTH: number;
  pph: number;
  pphTanpaThr: number;
  pphAtasThr: number;
  neto: number;
  netoRegular: number;
  thrBruto: number;
  isPR?: boolean;
  isMasaPajakTerakhir?: boolean;
  periodeAdaTHR?: boolean;
  reconciliation?: {
    brutoYTD: number;
    pphYTD: number;
    saldoAwalBruto?: number;
    saldoAwalPph?: number;
    saldoSdBulan?: number;
    brutoDariPeriode?: number;
    pphDariPeriode?: number;
    opsiLebihBayar?: string;
    isPajakTerakhir?: boolean;
    brutoTahunan: number;
    pphTahunan: number;
    pphBulanIni?: number;
    lebihBayar: number;
    kurangBayar: number;
    tipePeriode: string;
    reason: string;
    tglBerhenti?: string;
  } | null;
  bpjs: Record<string, number>;
  /** Tunjangan yang ikut basis BPJS / gross PPh / take home. */
  tBPJS: number;
  tGross: number;
  tTH: number;
  tItems: Array<Record<string, unknown> & { eff: number; inTH: boolean }>;
  natKP: number;
  natNKP: number;
  /** Lembur (rupiah). */
  lb: number;
  bpjsPrsNatKP: number;
  koreksiAbsensi: { total: number; details: Array<{ label: string; nilai: number }> };
  pr?: ProrataEntry;
  thrObj?: Record<string, unknown> | null;
  phk?: {
    /** 'resign' | 'phk' */
    mode: string;
    tgl: string;
    items: Array<{ nama: string; nilai: number }>;
    bruto: number;
    pphFinal: number;
    pphFinalBase: number;
  } | null;
  potKehadiran: { total: number; details: Array<{ label: string; nilai: number }>; gajiHarian?: number };
  potT: number;
  pphRet: number;
  /** Lebih bayar PPh rekonsiliasi yang dikembalikan ke THP (0 bila carryover). */
  refundPph: number;
  totalPot: number;
  bebanPrs: number;
  grossPPhRegular: number;
}

interface RincianCutiItem {
  tgl: string;
  hariKerja: boolean;
  cutiBersama: boolean;
  namaLibur: string;
  diAbsensi: boolean;
  tahunLalu: boolean;
  hitung: 'manual' | 'cuti_bersama' | 'tidak';
}

interface RincianCuti {
  items: RincianCutiItem[];
  manual: number;
  cb: number;
  total: number;
}

interface KaryawanPayroll {
  nik: string;
  nama?: string;
  jk?: string;
  hp?: string;
  email?: string;
  npwp?: string;
  ktp?: string;
  aktif?: boolean;
  gapok: Rupiah;
  siklus_gaji?: 'bulanan' | 'harian' | 'mingguan' | string;
  hari_gaji?: number;
  ptkp: string;
  masuk?: string;
  tgl_berhenti?: string;
  cabangId?: string;
  cabang?: string;
  mutasi_payroll_efektif?: string;
  phk?: PhkData;
  tipe_kerja?: string;
  dept?: string;
  jabatan?: string;
  status?: string;
  agama?: string;
  alamat?: string;
  atasan?: string;
  lokasi?: string;
  bank?: string;
  norek?: string;
  reknam?: string;
  /** Baris baru di form karyawan yang belum disimpan. */
  _new?: boolean;
  mutasi_riwayat?: Array<Record<string, any>>;
  tunjangan?: Array<{
    nama: string;
    nilai: Rupiah;
    tipe: string;
    thr_ikut?: boolean;
    prorata_ikut?: boolean;
  }>;
  potongan?: Array<{ nama: string; nilai: Rupiah; ket?: string }>;
  natura?: Array<{ nama: string; nilai: Rupiah; kp?: boolean }>;
  bpjs_aktif?: Record<string, boolean>;
  bpjs_manual?: Record<string, Rupiah>;
  pph_return?: { nilai?: Rupiah; ket?: string };
  pph_ytd_awal?: Record<string, { bruto?: number; pph?: number; sd_bulan?: number }>;
}
