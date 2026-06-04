import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './app.jsx'
import { AppProvider } from './context/AppContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    const checkUpdate = () => registration.update();

    // Verificar update a cada 30s e quando a janela volta ao foco
    setInterval(checkUpdate, 30 * 1000);
    window.addEventListener('focus', checkUpdate);

    registration.addEventListener('updatefound', () => {
      const newSW = registration.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // Forçar activação imediata sem esperar por tabs fechadas
          newSW.postMessage({ type: 'SKIP_WAITING' });
        }
        if (newSW.state === 'activated') {
          window.location.reload();
        }
      });
    });
  });

  // Se houver um SW em espera (waiting), activá-lo imediatamente
  navigator.serviceWorker.ready.then(registration => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });

  // Recarregar quando o SW tomar controlo
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}