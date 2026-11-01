// Renders each .pdf-viewer on the page with PDF.js, which is only downloaded
// once a viewer scrolls near the screen. See _includes/pdf-viewer.html.
(function () {
  var PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  var MIN_ZOOM = 0.5;
  var MAX_ZOOM = 4;
  var MAX_CANVAS_PIXELS = 16000000; // Larger canvases fail on some phones

  var pdfjsPromise;

  function loadPdfJs() {
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = PDFJS_BASE + 'pdf.min.js';
        script.onload = function () {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    return pdfjsPromise;
  }

  function renderPage(page, canvas, cssWidth) {
    var scale = cssWidth / page.getViewport({ scale: 1 }).width;
    var size = page.getViewport({ scale: scale });
    var density = Math.min(
      window.devicePixelRatio || 1,
      Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height))
    );
    var viewport = page.getViewport({ scale: scale * density });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = Math.floor(size.width) + 'px';
    canvas.style.height = Math.floor(size.height) + 'px';

    return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
  }

  function initViewer(viewer) {
    var pagesEl = viewer.querySelector('.pdf-viewer__pages');
    var statusEl = viewer.querySelector('.pdf-viewer__status');
    var buttons = viewer.querySelectorAll('[data-zoom]');
    var pages = [];
    var fitWidth = pagesEl.clientWidth;
    var zoom = 1;

    function setBusy(busy) {
      buttons.forEach(function (button) { button.disabled = busy; });
    }

    function renderAll() {
      setBusy(true);
      return Promise.all(pages.map(function (entry) {
        return renderPage(entry.page, entry.canvas, fitWidth * zoom);
      })).then(function () { setBusy(false); });
    }

    function showError() {
      statusEl.textContent = 'Could not display the PDF here. Use Open PDF instead.';
      statusEl.hidden = false;
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var next = zoom + parseFloat(button.getAttribute('data-zoom'));
        zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
        renderAll().catch(showError);
      });
    });

    setBusy(true);
    loadPdfJs().then(function (pdfjsLib) {
      return pdfjsLib.getDocument(viewer.getAttribute('data-src')).promise;
    }).then(function (pdf) {
      var numbers = [];
      for (var i = 1; i <= pdf.numPages; i++) numbers.push(i);
      return Promise.all(numbers.map(function (number) { return pdf.getPage(number); }));
    }).then(function (loaded) {
      pages = loaded.map(function (page) {
        var canvas = document.createElement('canvas');
        pagesEl.appendChild(canvas);
        return { page: page, canvas: canvas };
      });
      statusEl.hidden = true;
      return renderAll();
    }).catch(showError);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        initViewer(entry.target);
      }
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('.pdf-viewer').forEach(function (viewer) {
    observer.observe(viewer);
  });
})();
