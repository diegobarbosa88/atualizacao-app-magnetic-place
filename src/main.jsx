import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

// /partilha/resumo é decidida ANTES de montar qualquer coisa relacionada com
// o resto da app — AppProvider nunca chega a existir nesta rota, por isso os
// seus useEffects de fetch (workers/clients/logs/etc., disparados ao montar)
// nunca correm. Não é uma verificação "por dentro"; é o componente não ser
// instanciado. Ver ResumoMensalPublico.jsx — não depende de react-router nem
// de AppContext, por isso não precisa de BrowserRouter/AppProvider.
const isResumoPublico = window.location.pathname === '/partilha/resumo';

async function bootstrap() {
  if (isResumoPublico) {
    const { default: ResumoMensalPublico } = await import('./features/public/ResumoMensalPublico.jsx');
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <ResumoMensalPublico />
      </StrictMode>,
    );
  } else {
    const { default: App } = await import('./app.jsx');
    const { AppProvider } = await import('./context/AppContext.jsx');
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppProvider>
            <App />
          </AppProvider>
        </BrowserRouter>
      </StrictMode>,
    );
  }
}

bootstrap();

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
