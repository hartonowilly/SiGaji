/**
 * Deklarasi global SiGaji untuk // @ts-check di app-core.js (tanpa rewrite ke TypeScript).
 */
declare var perusahaan: {
  hariKerja?: number;
  ter_custom?: Record<string, number[]>;
  ptkp_nilai?: Record<string, number>;
  umk?: Record<string, unknown>;
  aturan_potongan?: Record<string, { mode?: string; nilai?: number }>;
};

declare var periodes: Array<{
  id: number | string;
  nama: string;
  start: string;
  end: string;
  bayar: string;
  status: string;
  thr_aktif?: boolean;
  tipe_periode?: string;
  opsi_lebih_bayar?: string;
}>;

declare var hariLibur: Array<{ tgl: string; nama?: string; tipe?: string }>;
declare var masterCuti: { cbPotong?: boolean; kuota?: number };
declare var absensi: Record<string, Record<string, string>>;
declare var prorata: Record<string, Record<string, { enabled?: boolean; hk?: number; hh?: number; manual?: boolean }>>;
declare var thrManual: Record<string, Record<string, { aktif?: boolean; nilai?: number }>>;
declare var lembur: Record<string, Array<{ tanggal?: string; jam?: string | number }>>;
declare var karSnapshot: Record<string, Record<string, unknown>>;
declare var karyawan: Array<Record<string, unknown>>;
declare var tunjVarBulan: Record<string, Record<string, Record<string, number>>>;
declare var tunjVarLabels: Record<string, string>;
declare var approvals: Array<Record<string, unknown>>;

declare function nilaiPTKP(key: string): number;
declare function saveAll(): void;
declare function renderPenggajian(): void;
declare function hitungPesangon(k: Record<string, unknown>): {
  ok: boolean;
  up?: number;
  upmk?: number;
  uph?: number;
  pisah?: number;
};

interface Window {
  SIGAJI_CLOUD_ONLY_MODE?: boolean;
}

/** Hasil hitungGaji — field utama untuk slip & laporan. */
interface HitungGajiResult {
  gapokEff: number;
  gapokFull: number;
  grossPPh: number;
  grossPPhRegular: number;
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
  potKehadiran: { total: number };
  potT: number;
  pphRet: number;
  totalPot: number;
  bebanPrs: number;
}

interface KaryawanPayroll {
  nik: string;
  nama?: string;
  gapok: number;
  ptkp: string;
  masuk?: string;
  tgl_berhenti?: string;
  phk?: { alasan?: string };
  tunjangan?: Array<{
    nama: string;
    nilai: number;
    tipe: string;
    thr_ikut?: boolean;
    prorata_ikut?: boolean;
  }>;
  potongan?: Array<{ nama: string; nilai: number; ket?: string }>;
  natura?: Array<{ nama: string; nilai: number; kp?: boolean }>;
  bpjs_aktif?: Record<string, boolean>;
  bpjs_manual?: Record<string, number>;
  pph_return?: { nilai?: number; ket?: string };
  pph_ytd_awal?: Record<string, { bruto?: number; pph?: number; sd_bulan?: number }>;
}
