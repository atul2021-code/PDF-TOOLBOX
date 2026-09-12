(function () {
  // pdf.js needs its worker script; point it at the same CDN build we loaded.
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  Router.init();
  ToolMerge.init();
  ToolSplit.init();
  ToolOrganize.init();
  ToolEdit.init();
  ToolAddText.init();
  ToolWatermark.init();
  ToolPageNumbers.init();
  ToolPdf2Img.init();
  ToolImg2Pdf.init();
})();
