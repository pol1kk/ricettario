import { useEffect } from 'react';

/** Tiene acceso lo schermo finché `attivo` è vero; dove non è supportato non fa nulla. */
export function usaSchermoAcceso(attivo: boolean) {
  useEffect(() => {
    if (!attivo || !('wakeLock' in navigator)) return;
    let blocco: WakeLockSentinel | null = null;
    let finito = false;
    const chiedi = () =>
      navigator.wakeLock.request('screen').then(
        (b) => {
          if (finito) void b.release();
          else blocco = b;
        },
        () => undefined,
      );
    // il blocco si perde quando l'app va in secondo piano: si richiede al ritorno
    const visibile = () => document.visibilityState === 'visible' && void chiedi();
    void chiedi();
    document.addEventListener('visibilitychange', visibile);
    return () => {
      finito = true;
      document.removeEventListener('visibilitychange', visibile);
      void blocco?.release();
    };
  }, [attivo]);
}
