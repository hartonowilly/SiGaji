/**
 * Kebijakan pindah tautan Telegram saat ganti NIK.
 * Cakupan cabang NIK asal/tujuan dicek di handler (assertNikInScope).
 * NIK tujuan yang sudah karyawan lain atau sudah bertautan ditolak — jangan hapus tautan orang lain.
 */
export function telegramMoveDestConflict(destKaryawan, destHasLink) {
  if (destKaryawan) return { status: 409, error: 'NIK tujuan sudah dipakai karyawan lain' };
  if (destHasLink) return { status: 409, error: 'NIK tujuan sudah punya tautan Telegram' };
  return null;
}
