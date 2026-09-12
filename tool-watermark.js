const ToolWatermark = (() => {
  let currentFile = null;

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    document.getElementById('watermark-panel').hidden = false;
  }

  function hexToRgb01(hex) {
    const m = hex.replace('#', '');
    return [
      parseInt(m.substring(0, 2), 16) / 255,
      parseInt(m.substring(2, 4), 16) / 255,
      parseInt(m.substring(4, 6), 16) / 255,
    ];
  }

  async function run() {
    if (!currentFile) return;
    const statusEl = document.getElementById('watermark-status');
    statusEl.textContent = 'Stamping…';
    try {
      const text = document.getElementById('watermark-text').value || 'DRAFT';
      const size = parseInt(document.getElementById('watermark-size').value, 10) || 72;
      const opacity = parseFloat(document.getElementById('watermark-opacity').value);
      const rotation = parseInt(document.getElementById('watermark-rotation').value, 10) || 0;
      const color = hexToRgb01(document.getElementById('watermark-color').value);

      const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
      const bytes = await Utils.readFileAsArrayBuffer(currentFile);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size, font,
          color: rgb(color[0], color[1], color[2]),
          opacity,
          rotate: degrees(rotation),
        });
      }

      const outBytes = await doc.save();
      Utils.downloadBytes(outBytes, `${Utils.baseName(currentFile.name)}-watermarked.pdf`);
      statusEl.textContent = 'Done.';
      Utils.toast('Watermarked PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not watermark: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('watermark-drop'),
      document.getElementById('watermark-input'),
      handleFile
    );
    document.getElementById('watermark-run').addEventListener('click', run);
  }

  return { init };
})();
