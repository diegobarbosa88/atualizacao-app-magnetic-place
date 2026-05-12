import { replaceTemplateFields } from './templateFields';

export const getPreviewHtml = (html, workerData = {}, systemData = {}, zoom = 100) => {
  const scale = zoom / 100;
  const processedHtml = replaceTemplateFields(html, workerData, systemData);

  const dragStyles = `
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: visible; background: #f1f5f9; }
      body { display: flex; justify-content: center; align-items: flex-start; position: relative; box-sizing: border-box; }
      .a4-page { width: 210mm; min-height: 297mm; margin: 0; padding: 15mm; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; position: relative; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      #worker-qrcode-placeholder, #worker-signature-placeholder {
        cursor: move !important;
        position: absolute !important;
        z-index: 1000 !important;
        box-sizing: border-box;
      }
      #worker-qrcode-placeholder {
        border: 2px dashed #6366f1 !important;
        background: rgba(99, 102, 241, 0.15) !important;
        padding: 4px !important;
        min-width: 60px;
        min-height: 60px;
      }
      #worker-signature-placeholder {
        border: 2px dashed #10b981 !important;
        background: rgba(16, 185, 129, 0.15) !important;
        padding: 4px !important;
        min-width: 100px;
        min-height: 80px;
      }
      @media print {
        html, body { margin: 0; padding: 0; background: white; }
        .a4-page { width: 210mm; margin: 0; padding: 15mm; box-shadow: none; }
      }
    </style>
  `;

  const dragScript = `
    <script>
      (function() {
        function initDraggable() {
          var ids = ['worker-qrcode-placeholder', 'worker-signature-placeholder'];

          for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (!el) continue;

            if (!el.style.position || el.style.position === 'static' || el.style.position === '') {
              el.style.position = 'absolute';
            }

            el.addEventListener('mousedown', (function(currentEl) {
              return function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
                if (e.target.closest('button')) return;

                e.preventDefault();
                e.stopPropagation();

                var rect = currentEl.getBoundingClientRect();
                var startX = e.clientX;
                var startY = e.clientY;
                var rawLeft = parseInt(currentEl.style.left);
                var rawTop = parseInt(currentEl.style.top);
                var origLeft = isNaN(rawLeft) ? rect.left : rawLeft;
                var origTop = isNaN(rawTop) ? rect.top : rawTop;

                function onMouseMove(e) {
                  e.preventDefault();
                  currentEl.style.left = (origLeft + (e.clientX - startX)) + 'px';
                  currentEl.style.top = (origTop + (e.clientY - startY)) + 'px';
                }

                function onMouseUp() {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);

                  if (window.parent !== window) {
                    window.parent.postMessage({
                      type: 'elementMoved',
                      id: currentEl.id,
                      left: currentEl.style.left,
                      top: currentEl.style.top
                    }, '*');
                  }
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              };
            })(el));
          }
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initDraggable);
        } else {
          initDraggable();
        }
      })();
    </script>
  `;

  const headMatch = processedHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const hasHead = headMatch !== null;
  const bodyMatch = processedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const hasBody = bodyMatch !== null;

  if (!hasBody) {
    const content = processedHtml;
    return '<!DOCTYPE html><html><head>' + dragStyles + '</head><body>' + content + dragScript + '</body></html>';
  }

  let result = processedHtml;

  if (hasHead) {
    result = result.replace(/(<\/head>)/i, dragStyles + '$1');
  } else {
    result = result.replace(/(<html[^>]*>)/i, '$1<head>' + dragStyles + '</head>');
  }

  result = result.replace(/(<\/body>)/i, dragScript + '$1');

  return result;
};
