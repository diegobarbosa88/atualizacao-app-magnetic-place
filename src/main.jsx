import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './app.jsx'
import { AppProvider } from './context/AppContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    // Verificar update ao focar a janela e periodicamente
    const checkUpdate = () => registration.update();
    window.addEventListener('focus', checkUpdate);
    setInterval(checkUpdate, 60 * 1000);

    // Quando um novo SW é encontrado, activá-lo imediatamente
    registration.addEventListener('updatefound', () => {
      const newSW = registration.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed') {
          newSW.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // Se já há um SW em espera, activá-lo
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });

  // Recarregar uma vez quando o SW tomar controlo (evita loop)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
