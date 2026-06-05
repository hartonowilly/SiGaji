/* Resume sesi cloud — muat segera setelah <body> */
(function () {
  try {
    if (localStorage.getItem('sigaji_resume_hint') === '1') {
      document.documentElement.setAttribute('data-sigaji-resume-pending', '1');
      setTimeout(function () {
        try {
          if (document.documentElement.getAttribute('data-sigaji-resume-pending') === '1') {
            document.documentElement.removeAttribute('data-sigaji-resume-pending');
            var lg = document.getElementById('login');
            if (lg) lg.style.display = 'flex';
          }
        } catch (e) {}
      }, 4000);
    }
  } catch (e) {}
})();
