const ToolEdit = (() => {
  let currentFile = null;
  let srcBytes = null;
  let pdfjsDoc = null;
  let pageNum = 1;
  let numPages = 0;
  let viewport = null;
  let lines = [];              // current page's clustered text lines
  let canvas, ctx, overlay;
  // edits: Map "pageIndex:lineIndex" -> { rect, text, fontSize, color, bg, bold, italic }
  let edits = new Map();
  let activeEditorKey = null;

  const SCALE = 1.6;

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    currentFile = file;
    edits.clear();
    try {
      srcBytes = await Utils.readFileAsArrayBuffer(file);
      pdfjsDoc = await pdfjsLib.getDocument({ data: srcBytes.slice(0) }).promise;
      numPages = pdfjsDoc.numPages;
      pageNum = 1;
      canvas = document.getElementById('edit-canvas');
      ctx = canvas.getContext('2d');
      overlay = document.getElementById('edit-overlay');
      document.getElementById('edit-panel').hidden = false;
      await renderPage();
    } catch (err) {
      console.error(err);
      Utils.toast('Could not read that PDF: ' + err.message, true);
    }
  }

  // Group raw text items into visual "lines" so a click always redacts the
  // whole phrase, never just a fragment of it (a PDF often splits one
  // visible word across several internal text-runs).
  function buildLines(textContent) {
    const items = textContent.items.filter(it => it.str.trim().length || it.str.includes(' '));
    items.sort((a, b) => {
      const dy = b.transform[5] - a.transform[5];
      if (Math.abs(dy) > 1.5) return dy;
      return a.transform[4] - b.transform[4];
    });

    const built = [];
    let cluster = null;
    for (const it of items) {
      const x0 = it.transform[4];
      const y0 = it.transform[5];
      const fontSize = Math.hypot(it.transform[0], it.transform[1]) || it.height || 10;
      const x1 = x0 + (it.width || fontSize * it.str.length * 0.5);
      const y1 = y0 + (it.height || fontSize);

      if (cluster &&
          Math.abs(cluster.baseline - y0) < Math.max(1.5, fontSize * 0.25) &&
          x0 - cluster.rect[2] < fontSize * 1.2) {
        cluster.text += it.str;
        cluster.rect[0] = Math.min(cluster.rect[0], x0);
        cluster.rect[1] = Math.min(cluster.rect[1], y0);
        cluster.rect[2] = Math.max(cluster.rect[2], x1);
        cluster.rect[3] = Math.max(cluster.rect[3], y1);
        cluster.fontName = cluster.fontName || it.fontName;
      } else {
        cluster = {
          text: it.str,
          rect: [x0, y0, x1, y1],
          baseline: y0,
          fontSize,
          fontName: it.fontName,
        };
        built.push(cluster);
      }
    }
    return built.filter(c => c.text.trim().length > 0);
  }

  async function renderPage() {
    closeActiveEditor(false);
    const page = await pdfjsDoc.getPage(pageNum);
    viewport = page.getViewport({ scale: SCALE });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.style.width = viewport.width + 'px';
    overlay.style.height = viewport.height + 'px';
    await page.render({ canvasContext: ctx, viewport }).promise;

    const textContent = await page.getTextContent();
    lines = buildLines(textContent);

    // Re-draw any edits already made on this page during this session.
    for (const [key, edit] of edits) {
      if (key.startsWith(pageNum + ':')) drawEditOnCanvas(edit);
    }

    document.getElementById('edit-pageinfo').textContent = `Page ${pageNum} / ${numPages}`;
    overlay.onclick = onOverlayClick;
  }

  function pdfRectToCanvasRect(rect) {
    const [x0, y0, x1, y1] = rect;
    const p1 = viewport.convertToViewportPoint(x0, y0);
    const p2 = viewport.convertToViewportPoint(x1, y1);
    return {
      left: Math.min(p1[0], p2[0]),
      top: Math.min(p1[1], p2[1]),
      width: Math.abs(p2[0] - p1[0]),
      height: Math.abs(p2[1] - p1[1]),
    };
  }

  function sampleColors(canvasRect) {
    const pad = 4;
    const cx = Math.max(0, Math.round(canvasRect.left));
    const cy = Math.max(0, Math.round(canvasRect.top));
    const cw = Math.max(1, Math.round(canvasRect.width));
    const ch = Math.max(1, Math.round(canvasRect.height));

    let fg = [0, 0, 0];
    try {
      const inner = ctx.getImageData(cx, cy, cw, ch).data;
      let darkest = 255 * 3;
      for (let i = 0; i < inner.length; i += 4) {
        const sum = inner[i] + inner[i + 1] + inner[i + 2];
        if (sum < darkest) { darkest = sum; fg = [inner[i], inner[i + 1], inner[i + 2]]; }
      }
    } catch (e) { /* out of bounds, keep default */ }

    const strips = [
      [cx - pad, cy, pad, ch],
      [cx + cw, cy, pad, ch],
      [cx, cy - pad, cw, pad],
      [cx, cy + ch, cw, pad],
    ];
    let bg = [255, 255, 255];
    let bestCount = -1;
    for (const [sx, sy, sw, sh] of strips) {
      if (sx < 0 || sy < 0 || sw <= 0 || sh <= 0) continue;
      if (sx + sw > canvas.width || sy + sh > canvas.height) continue;
      try {
        const data = ctx.getImageData(sx, sy, sw, sh).data;
        const counts = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const key = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        for (const [key, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bg = key.split(',').map(Number);
          }
        }
      } catch (e) { /* skip */ }
    }
    return {
      fg: fg.map(v => v / 255),
      bg: bg.map(v => v / 255),
    };
  }

  function drawEditOnCanvas(edit) {
    const r = pdfRectToCanvasRect(edit.rect);
    const bgCss = `rgb(${edit.bg.map(v => Math.round(v * 255)).join(',')})`;
    const fgCss = `rgb(${edit.color.map(v => Math.round(v * 255)).join(',')})`;
    ctx.fillStyle = bgCss;
    ctx.fillRect(r.left - 2, r.top - 2, r.width + 4, r.height + 4);
    ctx.fillStyle = fgCss;
    ctx.font = `${edit.italic ? 'italic ' : ''}${edit.bold ? '600 ' : ''}${edit.fontSize * SCALE}px sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(edit.text, r.left, r.top + r.height);
  }

  function onOverlayClick(e) {
    const rect = overlay.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    // Convert CSS px (post max-width scaling) to canvas pixel space.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = cssX * scaleX;
    const py = cssY * scaleY;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(px, py);

    closeActiveEditor(true);

    let hitIndex = -1;
    lines.forEach((line, i) => {
      const [x0, y0, x1, y1] = line.rect;
      if (pdfX >= x0 - 1 && pdfX <= x1 + 1 && pdfY >= y0 - 1 && pdfY <= y1 + 1) hitIndex = i;
    });
    if (hitIndex === -1) return;

    openInlineEditor(hitIndex);
  }

  function openInlineEditor(lineIndex) {
    const line = lines[lineIndex];
    const key = pageNum + ':' + lineIndex;
    const existingEdit = edits.get(key);
    const rect = existingEdit ? existingEdit.rect : line.rect;
    const canvasRect = pdfRectToCanvasRect(rect);
    const cssScale = canvas.getBoundingClientRect().width / canvas.width;

    const fontName = (line.fontName || '').toLowerCase();
    const bold = existingEdit ? existingEdit.bold : fontName.includes('bold');
    const italic = existingEdit ? existingEdit.italic : (fontName.includes('italic') || fontName.includes('oblique'));
    const fontSize = existingEdit ? existingEdit.fontSize : line.fontSize;
    const colors = existingEdit
      ? { fg: existingEdit.color, bg: existingEdit.bg }
      : sampleColors(canvasRect);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = existingEdit ? existingEdit.text : line.text;
    input.style.left = (canvasRect.left * cssScale) + 'px';
    input.style.top = (canvasRect.top * cssScale) + 'px';
    input.style.width = Math.max(40, canvasRect.width * cssScale + 12) + 'px';
    input.style.height = Math.max(16, canvasRect.height * cssScale + 6) + 'px';
    input.style.fontSize = Math.max(10, fontSize * SCALE * cssScale * 0.85) + 'px';
    input.style.background = `rgb(${colors.bg.map(v => Math.round(v * 255)).join(',')})`;
    input.style.color = `rgb(${colors.fg.map(v => Math.round(v * 255)).join(',')})`;

    overlay.appendChild(input);
    input.focus();
    input.select();

    activeEditorKey = key;
    const commit = () => {
      const newText = input.value;
      input.remove();
      activeEditorKey = null;
      if (newText === line.text && !existingEdit) return;
      if (newText === (existingEdit ? existingEdit.text : line.text)) return;

      const edit = {
        rect: rect.slice(),
        text: newText,
        fontSize,
        color: colors.fg,
        bg: colors.bg,
        bold, italic,
      };
      edits.set(key, edit);
      drawEditOnCanvas(edit);
    };
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      if (ev.key === 'Escape') { ev.preventDefault(); input.remove(); activeEditorKey = null; }
    });
    input.addEventListener('blur', commit);
  }

  function closeActiveEditor(commit) {
    const input = overlay && overlay.querySelector('input');
    if (input) {
      if (commit) input.blur();
      else input.remove();
    }
    activeEditorKey = null;
  }

  async function changePage(delta) {
    const next = pageNum + delta;
    if (next < 1 || next > numPages) return;
    pageNum = next;
    await renderPage();
  }

  async function run() {
    if (!currentFile) return;
    const statusEl = document.getElementById('edit-status');
    statusEl.textContent = 'Applying edits…';
    try {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const outDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const fontCache = {};
      async function fontFor(bold, italic) {
        const key = (bold ? 'b' : '') + (italic ? 'i' : '');
        if (fontCache[key]) return fontCache[key];
        let std = StandardFonts.Helvetica;
        if (bold && italic) std = StandardFonts.HelveticaBoldOblique;
        else if (bold) std = StandardFonts.HelveticaBold;
        else if (italic) std = StandardFonts.HelveticaOblique;
        const f = await outDoc.embedFont(std);
        fontCache[key] = f;
        return f;
      }

      for (const [key, edit] of edits) {
        const [pgStr] = key.split(':');
        const pIndex = parseInt(pgStr, 10) - 1;
        const page = outDoc.getPage(pIndex);
        const [x0, y0, x1, y1] = edit.rect;
        const padX = Math.max(2, edit.fontSize * 0.25);
        const padY = Math.max(1, edit.fontSize * 0.15);
        page.drawRectangle({
          x: x0 - padX, y: y0 - padY,
          width: (x1 - x0) + padX * 2, height: (y1 - y0) + padY * 2,
          color: rgb(edit.bg[0], edit.bg[1], edit.bg[2]),
        });
        if (edit.text) {
          const font = await fontFor(edit.bold, edit.italic);
          page.drawText(edit.text, {
            x: x0, y: y0 + edit.fontSize * 0.12,
            size: edit.fontSize, font,
            color: rgb(edit.color[0], edit.color[1], edit.color[2]),
          });
        }
      }

      const outBytes = await outDoc.save();
      Utils.downloadBytes(outBytes, `${Utils.baseName(currentFile.name)}-edited.pdf`);
      statusEl.textContent = `Done — ${edits.size} edit(s) applied.`;
      Utils.toast('Edited PDF downloaded.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      Utils.toast('Could not apply edits: ' + err.message, true);
    }
  }

  function init() {
    Utils.setupDropzone(
      document.getElementById('edit-drop'),
      document.getElementById('edit-input'),
      handleFile
    );
    document.getElementById('edit-prev').addEventListener('click', () => changePage(-1));
    document.getElementById('edit-next').addEventListener('click', () => changePage(1));
    document.getElementById('edit-run').addEventListener('click', run);
  }

  return { init };
})();
