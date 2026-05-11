export const getPreviewHtml = (html, zoom = 100) => {
  const scale = zoom / 100;
  const dragStyles = `
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: visible; }
      body { position: relative; box-sizing: border-box; }
      .a4-page { width: 210mm; min-height: 297mm; margin: 0; padding: 15mm; box-sizing: border-box; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; position: relative; background: white; }
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
        html, body { margin: 0; padding: 0; }
        .a4-page { width: 210mm; margin: 0; padding: 15mm; }
      }
    </style>
  `;
  
  const wrappedHtml = html.replace('<body>', '<body><div class="a4-page">').replace('</body>', '</div></body>');
  
  const dragScript = `
    <script>
      (function() {
        function initDraggable() {
          const placeholders = [
            document.getElementById('worker-qrcode-placeholder'),
            document.getElementById('worker-signature-placeholder')
          ];
          
          placeholders.forEach(el => {
            if (!el) return;
            
            if (!el.style.position || el.style.position === 'static' || el.style.position === '') {
              el.style.position = 'absolute';
            }
            
            el.addEventListener('mousedown', function(e) {
              if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
              if (e.target.closest('button')) return;
              
              e.preventDefault();
              e.stopPropagation();
              
              const rect = el.getBoundingClientRect();
              const startX = e.clientX;
              const startY = e.clientY;
              const origLeft = parseInt(el.style.left) || rect.left;
              const origTop = parseInt(el.style.top) || rect.top;
              
              function onMouseMove(e) {
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                el.style.left = (origLeft + dx) + 'px';
                el.style.top = (origTop + dy) + 'px';
              }
              
              function onMouseUp(e) {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'elementMoved',
                    id: el.id,
                    left: el.style.left,
                    top: el.style.top
                  }, '*');
                }
              }
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            });
          });
        }
        
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initDraggable);
        } else {
          initDraggable();
        }
      })();
    </script>
  `;
  
  return dragStyles + dragScript + wrappedHtml;
};