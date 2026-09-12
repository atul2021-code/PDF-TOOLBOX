// Shared helpers used across every tool.

const Utils = (() => {

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadBytes(bytes, filename, mime) {
    downloadBlob(new Blob([bytes], { type: mime || 'application/pdf' }), filename);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function baseName(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }

  let toastTimer = null;
  function toast(message, isError) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle('error', !!isError);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // Wires a dropzone element + hidden file input together.
  // onFiles(FileList) is called whenever files are chosen or dropped.
  function setupDropzone(dropEl, inputEl, onFiles) {
    dropEl.addEventListener('click', () => inputEl.click());
    inputEl.addEventListener('change', () => {
      if (inputEl.files.length) onFiles(inputEl.files);
      inputEl.value = '';
    });
    ['dragenter', 'dragover'].forEach(evt =>
      dropEl.addEventListener(evt, e => {
        e.preventDefault();
        dropEl.classList.add('drag-over');
      })
    );
    ['dragleave', 'drop'].forEach(evt =>
      dropEl.addEventListener(evt, e => {
        e.preventDefault();
        dropEl.classList.remove('drag-over');
      })
    );
    dropEl.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    });
  }

  // Parses "1-3,5,8-9" into a zero-based, deduplicated, ordered page-index array.
  function parsePageRanges(text, pageCount) {
    const indices = new Set();
    const parts = text.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : start;
      const lo = Math.max(1, Math.min(start, end));
      const hi = Math.min(pageCount, Math.max(start, end));
      for (let p = lo; p <= hi; p++) indices.add(p - 1);
    }
    return [...indices].sort((a, b) => a - b);
  }

  // Generic drag-to-reorder for a list of <li>/.thumb elements. Calls
  // onReorder(fromIndex, toIndex) once a drag completes.
  function makeSortable(containerEl, itemSelector, onReorder) {
    let dragEl = null;
    containerEl.addEventListener('dragstart', e => {
      const item = e.target.closest(itemSelector);
      if (!item) return;
      dragEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    containerEl.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('dragging');
      dragEl = null;
    });
    containerEl.addEventListener('dragover', e => {
      e.preventDefault();
      const target = e.target.closest(itemSelector);
      if (!target || target === dragEl || !dragEl) return;
      const items = [...containerEl.querySelectorAll(itemSelector)];
      const dragIdx = items.indexOf(dragEl);
      const targetIdx = items.indexOf(target);
      if (dragIdx < targetIdx) {
        target.after(dragEl);
      } else {
        target.before(dragEl);
      }
    });
    containerEl.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragEl) return;
      const items = [...containerEl.querySelectorAll(itemSelector)];
      const newIndex = items.indexOf(dragEl);
      onReorder(newIndex);
    });
  }

  return {
    readFileAsArrayBuffer, readFileAsDataURL, downloadBlob, downloadBytes,
    formatBytes, baseName, toast, setupDropzone, parsePageRanges, makeSortable,
  };
})();
