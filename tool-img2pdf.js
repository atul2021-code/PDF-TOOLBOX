const ToolImg2Pdf = (() => {
  let items = []; // { file, id, dataUrl }

  async function render() {
    const list = document.getElementById('img2pdf-list');
    list.innerHTML = '';
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.id = item.id;
      li.innerHTML = `
        <span class="drag-handle">⠿</span>
        <img src="${item.dataUrl}" alt="">
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
    document.getElementById('img2pdf-run').disabled = items.length < 1;
  }

  async function addFiles(fileList) {
    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await Utils.readFileAsDataURL(file);
      items.push({ file, id: Math.random().toString(36).slice(2), dataUrl });
    }
    render();
  }

  function syncOrderFromDOM() {
    const ids = [...document.querySelectorAll('#img2pdf-list li')].map(li => li.dataset.id);
    items = ids.map(id => items.find(x => x.id === id));
  }

  async function run() {
    if (!items.length) return;
    const statusEl = document.getElementById('img2pdf-status');
    statusEl.textContent = 'Building…';
    try {
      const { PDFDocument } = PDFLib;
      const outDoc = await PDFDocument.create();

      for (const item of items) {
        const bytes = await Utils.readFileAsArrayBuffer(item.file);
        const isPng = item.file.type === 'image/png';
        const img = isPng ? await outDoc.embedPng(bytes) : await outDoc.embedJpg(bytes);
        const page = outDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }

      const outBytes = await outDoc.save();
      Utils.downloadBytes(outBytes, 'images.pdf');
      statusEl.textContent = `Done — ${items.length} page(s).`;
      Utils.toast('PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not build PDF: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('img2pdf-drop'),
      document.getElementById('img2pdf-input'),
      addFiles
    );
    Utils.makeSortable(document.getElementById('img2pdf-list'), 'li', syncOrderFromDOM);
    document.getElementById('img2pdf-run').addEventListener('click', run);
  }

  return { init };
})();
