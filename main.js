(function () {
  // pdf.js needs its worker script; point it at the same CDN build we loaded.
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } else {
    console.error('pdf.js did not load — check your internet connection / CDN access.');
  }

  // Each tool is initialized independently: if one throws (e.g. because a
  // script file 404'd and its module never got defined), it's logged to the
  // console but the rest of the toolbox still wires up normally instead of
  // silently breaking every tool that comes after it in this list.
  const tools = [
    ['Router', typeof Router !== 'undefined' && Router],
    ['ToolMerge', typeof ToolMerge !== 'undefined' && ToolMerge],
    ['ToolSplit', typeof ToolSplit !== 'undefined' && ToolSplit],
    ['ToolOrganize', typeof ToolOrganize !== 'undefined' && ToolOrganize],
    ['ToolEdit', typeof ToolEdit !== 'undefined' && ToolEdit],
    ['ToolAddText', typeof ToolAddText !== 'undefined' && ToolAddText],
    ['ToolWatermark', typeof ToolWatermark !== 'undefined' && ToolWatermark],
    ['ToolPageNumbers', typeof ToolPageNumbers !== 'undefined' && ToolPageNumbers],
    ['ToolPdf2Img', typeof ToolPdf2Img !== 'undefined' && ToolPdf2Img],
    ['ToolImg2Pdf', typeof ToolImg2Pdf !== 'undefined' && ToolImg2Pdf],
  ];

  const failures = [];
  for (const [name, mod] of tools) {
    if (!mod) {
      failures.push(name + ' (script did not load)');
      continue;
    }
    try {
      mod.init();
    } catch (err) {
      failures.push(name + ' (' + err.message + ')');
      console.error('Failed to initialize ' + name + ':', err);
    }
  }

  if (failures.length) {
    console.error('Paper Trail: the following failed to initialize:\n' + failures.join('\n'));
    const toastEl = document.getElementById('toast');
    if (toastEl) {
      toastEl.textContent = 'Some tools failed to load — open the browser console for details.';
      toastEl.hidden = false;
      toastEl.classList.add('error');
    }
  }
})();
