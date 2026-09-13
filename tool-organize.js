const ToolOrganize = (() => {
  let currentFile = null;
  let srcBytes = null;
  let pdfjsDoc = null;
  // pages: array of { origIndex, rotationDelta, id, baseRotation }
  let pages = [];
  let selected = new Set();

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    try {
      srcBytes = await Utils.readFileAsArrayBuffer(file);
      pdfjsDoc = await pdfjsLib.getDocument({ data: srcBytes.slice(0) }).promise;

      pages = [];
      for (let i = 0; i < pdfjsDoc.numPages; i++) {
        const page = await pdfjsDoc.getPage(i + 1);
        pages.push({
          origIndex: i,
          rotationDelta: 0,
          baseRotation: page.rotate || 0,
          id: 'p' + i,
        });
      }
      selected.clear();
      document.getElementById('organize-panel').hidden = false;
      await renderGrid();
    } catch (err) {
      console.error(err);
      Utils.toast('Could not read that PDF: ' + err.message, true);
    }
  }

  async function renderGrid() {
    const grid = document.getElementById('organize-grid');
    grid.innerHTML = '';
    for (const p of pages) {
      const wrap = document.createElement('div');
      wrap.className = 'thumb' + (selected.has(p.id) ? ' selected' : '');
      wrap.draggable = true;
      wrap.dataset.id = p.id;

      const canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      const label = document.createElement('div');
      label.className = 'thumb-num';
      label.textContent = `Page ${pages.indexOf(p) + 1}`;
      wrap.appendChild(label);
      grid.appendChild(wrap);

      const pdfPage = await pdfjsDoc.getPage(p.origIndex + 1);
      const totalRotation = (p.baseRotation + p.rotationDelta) % 360;
      const viewport = pdfPage.getViewport({ scale: 0.28, rotation: totalRotation });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      wrap.addEventListener('click', () => {
        if (selected.has(p.id)) selected.delete(p.id);
        else selected.add(p.id);
        wrap.classList.toggle('selected');
        document.getElementById('organize-selected-count').textContent = selected.size;
      });
    }
    document.getElementById('organize-selected-count').textContent = selected.size;
  }

  function syncOrderFromDOM() {
    const ids = [...document.querySelectorAll('#organize-grid .thumb')].map(el => el.dataset.id);
    pages = ids.map(id => pages.find(p => p.id === id));
    renumberLabels();
  }

  function renumberLabels() {
    document.querySelectorAll('#organize-grid .thumb').forEach((el, i) => {
      el.querySelector('.thumb-num').textContent = `Page ${i + 1}`;
    });
  }

  function rotateSelected(delta) {
    if (!selected.size) {
      Utils.toast('Click one or more pages first.', true);
      return;
    }
    pages.forEach(p => {
      if (selected.has(p.id)) p.rotationDelta = (p.rotationDelta + delta + 360) % 360;
    });
    renderGrid();
  }

  function deleteSelected() {
    if (!selected.size) {
      Utils.toast('Click one or more pages first.', true);
      return;
    }
    pages = pages.filter(p => !selected.has(p.id));
    selected.clear();
    renderGrid();
  }

  async function run() {
    if (!pages.length) return;
    const statusEl = document.getElementById('organize-status');
    statusEl.textContent = 'Saving…';
    try {
      const { PDFDocument, degrees } = PDFLib;
      const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(srcDoc, pages.map(p => p.origIndex));
      copied.forEach((page, i) => {
        const p = pages[i];
        const newRotation = (p.baseRotation + p.rotationDelta) % 360;
        page.setRotation(degrees(newRotation));
        outDoc.addPage(page);
      });
      const outBytes = await outDoc.save();
      Utils.downloadBytes(outBytes, `${Utils.baseName(currentFile.name)}-organized.pdf`);
      statusEl.textContent = `Done — ${pages.length} page(s) saved.`;
      Utils.toast('Organized PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not save: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('organize-drop'),
      document.getElementById('organize-input'),
      handleFile
    );
    Utils.makeSortable(document.getElementById('organize-grid'), '.thumb', syncOrderFromDOM);
    document.getElementById('organize-rotate-left').addEventListener('click', () => rotateSelected(-90));
    document.getElementById('organize-rotate-right').addEventListener('click', () => rotateSelected(90));
    document.getElementById('organize-delete').addEventListener('click', deleteSelected);
    document.getElementById('organize-run').addEventListener('click', run);
  }

  return { init };
})();
