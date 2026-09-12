# Paper Trail — a client-side PDF toolbox

A small, iLovePDF-style set of PDF tools that run **entirely in the browser**.
No server, no uploads, no accounts — your files never leave your machine.
It's a static site: open `index.html`, or host it anywhere (GitHub Pages works
great, with zero build step).

## Tools included

| Tool | What it does |
|---|---|
| **Merge PDF** | Combine multiple PDFs into one, drag to reorder first |
| **Split PDF** | Extract a page range, or explode every page into its own PDF (zipped) |
| **Organize pages** | Thumbnail board: drag to reorder, click to select, rotate, delete |
| **Edit text** | Click directly on existing text in the page to retype it in place |
| **Add text & sign** | Click to drop new text anywhere, or draw a signature and place it |
| **Watermark** | Stamp diagonal (or straight) text across every page |
| **Page numbers** | Number every page, several formats and positions |
| **PDF → Images** | Export every page as a PNG or JPG, zipped |
| **Images → PDF** | Turn a stack of photos/scans into one PDF, one image per page |

## Running it

**Locally:**
```bash
# any static file server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```
Opening `index.html` directly via `file://` also mostly works, but some
browsers restrict Web Workers on `file://` — a local server avoids that.

**On GitHub Pages:**
1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages** → set **Source** to your default branch, root folder.
3. Your toolbox will be live at `https://<username>.github.io/<repo>/` in a minute or two.

No build step, no `npm install` — it's plain HTML/CSS/JS loading
[pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/),
and [JSZip](https://stuk.github.io/jszip/) from a CDN.

## What's deliberately *not* here

iLovePDF's full suite includes some tools that genuinely need a real backend
(a server-side conversion engine, an OCR model, or a licensed crypto library) —
building those client-side would mean either silently doing a bad job or
shipping a multi-hundred-MB WASM blob. Cut for this reason:

- **PDF ⇄ Word / Excel / PowerPoint** — faithful layout conversion needs a real
  document-conversion engine (e.g. LibreOffice headless, or a paid API). Doable
  as a future addition if you stand up a small backend for just this.
- **OCR** — feasible client-side via `tesseract.js`, but it's a large
  download and slow in-browser; not wired in here, straightforward to add.
- **Password protect / unlock (encryption)** — `pdf-lib` doesn't implement PDF
  encryption. There are WASM ports of `qpdf` that could add this; not included
  to keep the dependency list small.
- **Compress** — real compression means re-encoding embedded images at lower
  quality/resolution, which is possible but was left out of this first pass to
  keep scope sane; happy to add a "downsample images" pass if useful.

## How "Edit text" actually works (read this before relying on it)

There's no such thing as universally-editable text in a PDF — text is stored
as positioned glyphs, not reflowable paragraphs. This tool uses the same
trick every simple PDF text-editor uses: it finds the text you clicked (using
pdf.js's text layer, grouped into whole lines so a split word doesn't leave
fragments behind), covers that area with a rectangle matching the sampled
background color, and draws your new text on top at the same size/color,
using the closest standard font (regular/bold/italic — not the exact original
typeface, since re-using an arbitrary embedded font isn't possible without
extracting it first).

**Important:** this covers the old text visually — it does not remove it from
the PDF's underlying content stream the way the redaction tool in the desktop
version of this project does. The original characters are technically still
present in the file and could be recovered by someone who goes looking. Don't
use this for anything you need genuinely redacted (SSNs, medical info, etc.).
If you need true redaction, use a tool built for it.

## Project structure

```
pdf-toolbox/
├── index.html          all views/screens (single page app)
├── css/style.css        design system + layout
└── js/
    ├── utils.js          shared helpers (file I/O, dropzone, toasts, sorting)
    ├── router.js         hash-based view switching
    ├── main.js           bootstraps pdf.js worker + all tools
    └── tool-*.js         one file per tool, each a self-contained module
```

Each tool file exposes a single `init()` — `main.js` calls all of them once
on load. No framework, no bundler; every file is loaded as a plain `<script>`
tag in `index.html`.

## Browser support

Needs a modern evergreen browser (Chrome, Firefox, Safari, Edge — recent
versions). Uses the Canvas API, `<input type="color">`, and ES2017+ JS
features (async/await, `Map`/`Set`).

## License

MIT — do whatever you'd like with it.
