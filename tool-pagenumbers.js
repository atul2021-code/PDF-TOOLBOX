const ToolPageNumbers = (() => {
  let currentFile = null;

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    document.getElementById('pagenumbers-panel').hidden = false;
  }

  function labelFor(format, n, total) {
    if (format === 'page-n') return `Page ${n}`;
    if (format === 'n-of-total') return `${n} of ${total}`;
    return String(n);
  }

  function positionFor(pos, textWidth, height, width, margin) {
    const map = {
      'bottom-center': { x: width / 2 - textWidth / 2, y: margin },
      'bottom-right': { x: width - textWidth - margin, y: margin },
      'bottom-left': { x: margin, y: margin },
      'top-center': { x: width / 2 - textWidth / 2, y: height - margin },
      'top-right': { x: width - textWidth - margin, y: height - margin },
    };
    return map[pos] || map['bottom-center'];
  }

  async function run() {
    if (!currentFile) return;
    const statusEl = document.getElementById('pagenumbers-status');
    statusEl.textContent = 'Numbering…';
    try {
      const start = parseInt(document.getElementById('pn-start').value, 10) || 1;
      const position = document.getElementById('pn-position').value;
      const format = document.getElementById('pn-format').value;

      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const bytes = await Utils.readFileAsArrayBuffer(currentFile);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const size = 10;
      const margin = 28;

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const label = labelFor(format, start + i, total);
        const textWidth = font.widthOfTextAtSize(label, size);
        const { x, y } = positionFor(position, textWidth, height, width, margin);
        page.drawText(label, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
      });

      const outBytes = await doc.save();
      Utils.downloadBytes(outBytes, `${Utils.baseName(currentFile.name)}-numbered.pdf`);
      statusEl.textContent = 'Done.';
      Utils.toast('Numbered PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not number pages: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('pagenumbers-drop'),
      document.getElementById('pagenumbers-input'),
      handleFile
    );
    document.getElementById('pagenumbers-run').addEventListener('click', run);
  }

  return { init };
})();
