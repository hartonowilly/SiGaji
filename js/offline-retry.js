/* SiGaji — tombol Coba lagi di halaman offline (file terpisah, lolos CSP). */
(function () {
  var btn = document.getElementById('retry');
  if (!btn) return;
  btn.addEventListener('click', function () {
    location.reload();
  });
})();
