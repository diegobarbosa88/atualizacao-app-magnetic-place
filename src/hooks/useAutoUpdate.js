import { useEffect, useRef } from 'react';

export function useAutoUpdate(intervalMs = 60_000) {
  const deployedVersion = useRef(null);

  useEffect(() => {
    const fetchVersion = () =>
      fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
        .then(r => r.json())
        .then(d => d.version)
        .catch(() => null);

    fetchVersion().then(v => { deployedVersion.current = v; });

    const check = async () => {
      const latest = await fetchVersion();
      if (latest && deployedVersion.current && latest !== deployedVersion.current) {
        window.location.reload();
      }
    };

    const timer = setInterval(check, intervalMs);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);
}
