const ToolSplit = (() => {
  let currentFile = null;
  let pageCount = 0;

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    try {
      const bytes = await Utils.readFileAsArrayBuffer(file);
      const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      pageCount = doc.getPageCount();
      document.getElementById('split-meta').textContent =
        `${file.name} — ${pageCount} page${pageCount === 1 ? '' : 's'}`;
      document.getElementById('split-range').placeholder = `1-${pageCount}`;
      document.getElementById('split-panel').hidden = false;
    } catch (err) {
      console.error(err);
      Utils.toast('Could not read that PDF: ' + err.message, true);
    }
  }

  async function run() {
    if (!currentFile) return;
    const mode = document.getElementById('split-mode').value;
    const statusEl = document.getElementById('split-status');
    statusEl.textContent = 'Working…';
    try {
      const bytes = await Utils.readFileAsArrayBuffer(currentFile);
      const srcDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      const base = Utils.baseName(currentFile.name);

      if (mode === 'range') {
        const rangeText = document.getElementById('split-range').value.trim()
          || `1-${pageCount}`;
        const indices = Utils.parsePageRanges(rangeText, pageCount);
        if (!indices.length) {
          statusEl.textContent = '';
          Utils.toast('That page range didn\'t match any pages.', true);
          return;
        }
        const outDoc = await PDFLib.PDFDocument.create();
        const pages = await outDoc.copyPages(srcDoc, indices);
        pages.forEach(p => outDoc.addPage(p));
        const outBytes = await outDoc.save();
        Utils.downloadBytes(outBytes, `${base}-extracted.pdf`);
        statusEl.textContent = `Done — extracted ${indices.length} page(s).`;
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pageCount; i++) {
          const outDoc = await PDFLib.PDFDocument.create();
          const [page] = await outDoc.copyPages(srcDoc, [i]);
          outDoc.addPage(page);
          const outBytes = await outDoc.save();
          zip.file(`${base}-page-${i + 1}.pdf`, outBytes);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        Utils.downloadBlob(zipBlob, `${base}-pages.zip`);
        statusEl.textContent = `Done — ${pageCount} single-page PDFs zipped.`;
      }
      Utils.toast('Split complete.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Split failed: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('split-drop'),
      document.getElementById('split-input'),
      handleFile
    );
    document.getElementById('split-mode').addEventListener('change', e => {
      document.getElementById('split-range-field').hidden = (e.target.value !== 'range');
    });
    document.getElementById('split-run').addEventListener('click', run);
  }

  return { init };
})();
