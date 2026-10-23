/**
 * Deklarasi global SiGaji untuk // @ts-check di app-core.js (tanpa rewrite ke TypeScript).
 * Juga dipakai typecheck:payroll (constants.js + ptkp.js).
 */
declare var perusahaan: {
  nama?: string;
  hariKerja?: number;
  ter_custom?: Record<string, number[]>;
  ptkp_nilai?: Record<string, number>;
  umk?: Record<string, unknown>;
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
  tipe_periode?: string;
  opsi_lebih_bayar?: string;
  snapshot_locked?: boolean;
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
declare var masterCuti: { cbPotong?: boolean; kuota?: number };
declare var absensi: Record<string, Record<string, string>>;
declare var prorata: Record<string, Record<string, ProrataEntry>>;
declare var thrManual: Record<string, Record<string, { aktif?: boolean; nilai?: Rupiah }>>;
declare var lembur: Record<string, Array<{ tanggal?: string; jam?: string | number }>>;
declare var karSnapshot: Record<string, Record<string, KarSnapshot>>;
declare var karyawan: KaryawanPayroll[];
declare var tunjVarBulan: Record<string, Record<string, Record<string, Rupiah>>>;
declare var tunjVarLabels: Record<string, string>;
declare var tunjVarColumns: Array<{ id: string; nama?: string }>;
declare var approvals: Array<Record<string, unknown>>;
declare var auditLog: Array<Record<string, unknown>>;
/** NIK karyawan yang sedang dibuka di panel payroll. */
declare var cpNik: string | null;

declare var CU: { role?: string; nama?: string; nik?: string } | null | undefined;

declare function sigajiCatchWarn(where: string, err: unknown): void;
declare function sigajiSortKaryawanByNik(list: KaryawanPayroll[]): KaryawanPayroll[];
declare function sigajiNextNik(list: KaryawanPayroll[]): string;
declare function sigajiFilterKaryawanByCabang(list: KaryawanPayroll[]): KaryawanPayroll[];
declare function sigajiKarCabangId(k: KaryawanPayroll): string;
declare function sigajiShowEl(el: Element): void;
declare function sigajiIsPanelVisible(el: Element | string): boolean;
declare function renderTunjPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function renderPotPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function loadBPJSPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function renderNaturaPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function renderPPhRetPanel(k: KaryawanPayroll | KarSnapshot): void;
declare function updateGajiSummary(): void;
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
  items: Array<{ tgl: string; upah: number; potongan: number; dibayar: number }>;
  sisaPotongan: number;
};
declare function liburSetFrom(list: unknown): Record<string, boolean>;
declare function saveAll(): void;
declare function toast(msg: string): void;
declare function openModal(id: string): void;
declare function closeModal(id: string): void;
declare function escapeHtml(s: string): string;
declare function escapeAttr(s: string): string;
declare function karyawanSortedAll(): Array<Record<string, unknown>>;
declare function renderKar(): void;
declare function renderPenggajian(): void;
declare function renderPPH(): void;
declare function updatePTKPVal(): void;
declare function hitungPesangon(k: KaryawanPayroll): {
  ok: boolean;
  up?: number;
  upmk?: number;
  uph?: number;
  pisah?: number;
};

interface SigajiIdbStore {
  available(): boolean;
  get(key: string): Promise<any>;
  put(key: string, value: unknown): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

interface Window {
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
    items: Array<{ tgl: string; upah: number; potongan: number; dibayar: number }>;
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
  koreksiAbsensi: { total: number; details: unknown[] };
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
  potKehadiran: { total: number };
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
  gapok: Rupiah;
  siklus_gaji?: 'bulanan' | 'harian' | 'mingguan' | string;
  hari_gaji?: number;
  ptkp: string;
  masuk?: string;
  tgl_berhenti?: string;
  cabangId?: string;
  cabang?: string;
  mutasi_payroll_efektif?: string;
  phk?: { alasan?: string };
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
