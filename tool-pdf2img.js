const ToolPdf2Img = (() => {
  let currentFile = null;
  let pdfjsDoc = null;

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    try {
      const bytes = await Utils.readFileAsArrayBuffer(file);
      pdfjsDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      document.getElementById('pdf2img-meta').textContent =
        `${file.name} — ${pdfjsDoc.numPages} page${pdfjsDoc.numPages === 1 ? '' : 's'}`;
      document.getElementById('pdf2img-panel').hidden = false;
    } catch (err) {
      console.error(err);
      Utils.toast('Could not read that PDF: ' + err.message, true);
    }
  }

  async function run() {
    if (!pdfjsDoc) return;
    const statusEl = document.getElementById('pdf2img-status');
    const format = document.getElementById('pdf2img-format').value;
    const scale = parseFloat(document.getElementById('pdf2img-scale').value);
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const base = Utils.baseName(currentFile.name);

    statusEl.textContent = 'Rendering…';
    try {
      const zip = new JSZip();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      for (let i = 0; i < pdfjsDoc.numPages; i++) {
        statusEl.textContent = `Rendering page ${i + 1} / ${pdfjsDoc.numPages}…`;
        const page = await pdfjsDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise(res => canvas.toBlob(res, mime, 0.92));
        zip.file(`${base}-page-${i + 1}.${ext}`, blob);
      }

      if (pdfjsDoc.numPages === 1) {
        const files = Object.values(zip.files);
        const blob = await files[0].async('blob');
        Utils.downloadBlob(blob, `${base}-page-1.${ext}`);
      } else {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        Utils.downloadBlob(zipBlob, `${base}-images.zip`);
      }
      statusEl.textContent = `Done — ${pdfjsDoc.numPages} image(s) exported.`;
      Utils.toast('Images downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Export failed: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('pdf2img-drop'),
      document.getElementById('pdf2img-input'),
      handleFile
    );
    document.getElementById('pdf2img-run').addEventListener('click', run);
  }

  return { init };
})();
