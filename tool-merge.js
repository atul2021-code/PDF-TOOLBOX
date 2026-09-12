const ToolMerge = (() => {
  let items = []; // { file, id }

  function render() {
    const list = document.getElementById('merge-list');
    list.innerHTML = '';
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.id = item.id;
      li.innerHTML = `
        <span class="drag-handle">⠿</span>
        <span class="file-name">${i + 1}. ${item.file.name}</span>
        <span class="file-meta">${Utils.formatBytes(item.file.size)}</span>
        <button class="remove-btn" title="Remove">✕</button>
      `;
      li.querySelector('.remove-btn').addEventListener('click', () => {
        items = items.filter(x => x.id !== item.id);
        render();
      });
      list.appendChild(li);
    });
    document.getElementById('merge-run').disabled = items.length < 2;
  }

  function addFiles(fileList) {
    for (const file of fileList) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
      items.push({ file, id: Math.random().toString(36).slice(2) });
    }
    render();
  }

  function syncOrderFromDOM() {
    const ids = [...document.querySelectorAll('#merge-list li')].map(li => li.dataset.id);
    items = ids.map(id => items.find(x => x.id === id));
  }

  async function run() {
    if (items.length < 2) return;
    const statusEl = document.getElementById('merge-status');
    statusEl.textContent = 'Merging…';
    try {
      const { PDFDocument } = PDFLib;
      const outDoc = await PDFDocument.create();
      for (const item of items) {
        const bytes = await Utils.readFileAsArrayBuffer(item.file);
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach(p => outDoc.addPage(p));
      }
      const outBytes = await outDoc.save();
      Utils.downloadBytes(outBytes, 'merged.pdf');
      statusEl.textContent = `Done — ${items.length} files merged.`;
      Utils.toast('Merged PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not merge those PDFs: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('merge-drop'),
      document.getElementById('merge-input'),
      addFiles
    );
    Utils.makeSortable(document.getElementById('merge-list'), 'li', syncOrderFromDOM);
    document.getElementById('merge-run').addEventListener('click', run);
  }

  return { init };
})();
