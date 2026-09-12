const ToolAddText = (() => {
  let currentFile = null;
  let srcBytes = null;
  let pdfjsDoc = null;
  let pageNum = 1;
  let numPages = 0;
  let viewport = null;
  let canvas, ctx, overlay;
  let mode = 'text';
  // placements: array of { pageIndex, type:'text'|'image', x, y, size, color, text, dataUrl, w, h }
  let placements = [];
  let signPad, signCtx, signHasInk = false;

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    placements = [];
    try {
      srcBytes = await Utils.readFileAsArrayBuffer(file);
      pdfjsDoc = await pdfjsLib.getDocument({ data: srcBytes.slice(0) }).promise;
      numPages = pdfjsDoc.numPages;
      pageNum = 1;
      canvas = document.getElementById('addtext-canvas');
      ctx = canvas.getContext('2d');
      overlay = document.getElementById('addtext-overlay');
      document.getElementById('addtext-panel').hidden = false;
      await renderPage();
    } catch (err) {
      console.error(err);
      Utils.toast('Could not read that PDF: ' + err.message, true);
    }
  }

  async function renderPage() {
    const page = await pdfjsDoc.getPage(pageNum);
    viewport = page.getViewport({ scale: 1.6 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.style.width = viewport.width + 'px';
    overlay.style.height = viewport.height + 'px';
    await page.render({ canvasContext: ctx, viewport }).promise;
    // Redraw any placements already made on this page.
    placements.filter(p => p.pageIndex === pageNum - 1).forEach(drawPlacement);
    document.getElementById('addtext-pageinfo').textContent = `Page ${pageNum} / ${numPages}`;
  }

  function drawPlacement(p) {
    const [cx, cy] = viewport.convertToViewportPoint(p.x, p.y);
    if (p.type === 'text') {
      ctx.fillStyle = p.color;
      ctx.font = `${p.size * (viewport.scale)}px sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(p.text, cx, cy);
    } else if (p.type === 'image') {
      const img = new Image();
      img.onload = () => {
        const [cx2, cy2] = viewport.convertToViewportPoint(p.x, p.y + p.h);
        ctx.drawImage(img, cx2, cy2, p.w * viewport.scale, p.h * viewport.scale);
      };
      img.src = p.dataUrl;
    }
  }

  function canvasPointFromEvent(e) {
    const rect = overlay.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [cssX * scaleX, cssY * scaleY];
  }

  function onOverlayClick(e) {
    const [px, py] = canvasPointFromEvent(e);
    const [pdfX, pdfY] = viewport.convertToPdfPoint(px, py);

    if (mode === 'text') {
      openTextInput(e, px, py, pdfX, pdfY);
    } else {
      placeSignature(pdfX, pdfY);
    }
  }

  function openTextInput(e, px, py, pdfX, pdfY) {
    const existing = overlay.querySelector('input');
    if (existing) existing.remove();

    const size = parseInt(document.getElementById('addtext-size').value, 10) || 14;
    const color = document.getElementById('addtext-color').value;
    const cssScale = canvas.getBoundingClientRect().width / canvas.width;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type text…';
    input.style.left = (px * cssScale) + 'px';
    input.style.top = (py * cssScale - size * cssScale) + 'px';
    input.style.width = '220px';
    input.style.fontSize = Math.max(10, size * cssScale) + 'px';
    input.style.color = color;
    overlay.appendChild(input);
    input.focus();

    const commit = () => {
      const text = input.value;
      input.remove();
      if (!text) return;
      const rgbColor = hexToRgb01(color);
      const placement = {
        pageIndex: pageNum - 1, type: 'text', x: pdfX, y: pdfY,
        size, color: `rgb(${rgbColor.map(v => Math.round(v * 255)).join(',')})`,
        colorRgb01: rgbColor, text,
      };
      placements.push(placement);
      drawPlacement(placement);
    };
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      if (ev.key === 'Escape') { ev.preventDefault(); input.remove(); }
    });
    input.addEventListener('blur', commit);
  }

  function hexToRgb01(hex) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16) / 255;
    const g = parseInt(m.substring(2, 4), 16) / 255;
    const b = parseInt(m.substring(4, 6), 16) / 255;
    return [r, g, b];
  }

  function placeSignature(pdfX, pdfY) {
    if (!signHasInk) {
      Utils.toast('Draw a signature first.', true);
      return;
    }
    const dataUrl = signPad.toDataURL('image/png');
    // Keep signature aspect ratio, scaled to a reasonable default width.
    const targetWidthPt = 130;
    const targetHeightPt = targetWidthPt * (signPad.height / signPad.width);
    const placement = {
      pageIndex: pageNum - 1, type: 'image', x: pdfX, y: pdfY - targetHeightPt,
      w: targetWidthPt, h: targetHeightPt, dataUrl,
    };
    placements.push(placement);
    drawPlacement(placement);
  }

  function setupSignPad() {
    signPad = document.getElementById('sign-pad');
    signCtx = signPad.getContext('2d');
    signCtx.lineWidth = 2.4;
    signCtx.lineCap = 'round';
    signCtx.strokeStyle = '#1b1b18';
    let drawing = false;

    function pos(e) {
      const rect = signPad.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [t.clientX - rect.left, t.clientY - rect.top];
    }
    function start(e) { drawing = true; signHasInk = true; const [x, y] = pos(e); signCtx.beginPath(); signCtx.moveTo(x, y); e.preventDefault(); }
    function move(e) { if (!drawing) return; const [x, y] = pos(e); signCtx.lineTo(x, y); signCtx.stroke(); e.preventDefault(); }
    function end() { drawing = false; }

    signPad.addEventListener('mousedown', start);
    signPad.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    signPad.addEventListener('touchstart', start, { passive: false });
    signPad.addEventListener('touchmove', move, { passive: false });
    signPad.addEventListener('touchend', end);

    document.getElementById('sign-clear').addEventListener('click', () => {
      signCtx.clearRect(0, 0, signPad.width, signPad.height);
      signHasInk = false;
    });
  }

  function setMode(newMode) {
    mode = newMode;
    document.getElementById('addtext-mode-text').classList.toggle('active', mode === 'text');
    document.getElementById('addtext-mode-sign').classList.toggle('active', mode === 'sign');
    document.getElementById('addtext-text-controls').hidden = mode !== 'text';
    document.getElementById('addtext-sign-controls').hidden = mode !== 'sign';
  }

  async function changePage(delta) {
    const next = pageNum + delta;
    if (next < 1 || next > numPages) return;
    pageNum = next;
    await renderPage();
  }

  async function run() {
    if (!currentFile) return;
    const statusEl = document.getElementById('addtext-status');
    if (!placements.length) {
      Utils.toast('Add some text or a signature first.', true);
      return;
    }
    statusEl.textContent = 'Building…';
    try {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const outDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const font = await outDoc.embedFont(StandardFonts.Helvetica);
      const imageCache = {};

      for (const p of placements) {
        const page = outDoc.getPage(p.pageIndex);
        if (p.type === 'text') {
          page.drawText(p.text, {
            x: p.x, y: p.y, size: p.size, font,
            color: rgb(p.colorRgb01[0], p.colorRgb01[1], p.colorRgb01[2]),
          });
        } else {
          let img = imageCache[p.dataUrl];
          if (!img) {
            const pngBytes = await (await fetch(p.dataUrl)).arrayBuffer();
            img = await outDoc.embedPng(pngBytes);
            imageCache[p.dataUrl] = img;
          }
          page.drawImage(img, { x: p.x, y: p.y, width: p.w, height: p.h });
        }
      }

      const outBytes = await outDoc.save();
      Utils.downloadBytes(outBytes, `${Utils.baseName(currentFile.name)}-annotated.pdf`);
      statusEl.textContent = `Done — ${placements.length} item(s) added.`;
      Utils.toast('Annotated PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not build PDF: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('addtext-drop'),
      document.getElementById('addtext-input'),
      handleFile
    );
    setupSignPad();
    document.getElementById('addtext-mode-text').addEventListener('click', () => setMode('text'));
    document.getElementById('addtext-mode-sign').addEventListener('click', () => setMode('sign'));
    document.getElementById('addtext-prev').addEventListener('click', () => changePage(-1));
    document.getElementById('addtext-next').addEventListener('click', () => changePage(1));
    document.getElementById('addtext-run').addEventListener('click', run);
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('addtext-overlay').addEventListener('click', onOverlayClick);
    });
    // overlay may already exist by init time (script runs after DOM parse)
    const ov = document.getElementById('addtext-overlay');
    if (ov) ov.addEventListener('click', onOverlayClick);
  }

  return { init };
})();
