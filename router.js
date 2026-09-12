// Minimal hash router: #/merge, #/split, etc. show the matching .view section.

const Router = (() => {
  const routes = ['home', 'merge', 'split', 'organize', 'edit', 'addtext',
                   'watermark', 'pagenumbers', 'pdf2img', 'img2pdf'];

  function currentRoute() {
    const hash = location.hash.replace(/^#\/?/, '');
    return routes.includes(hash) ? hash : 'home';
  }

  function show(route) {
    for (const r of routes) {
      const el = document.getElementById('view-' + r);
      if (el) el.hidden = (r !== route);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function init() {
    window.addEventListener('hashchange', () => show(currentRoute()));
    show(currentRoute());
  }

  return { init };
})();
