// Ricorda, su questo dispositivo, che l'utente ha già scelto una password:
// serve solo a non riproporre l'invito a impostarla.
const CHIAVE = 'ricettario.password-impostata';

export function passwordImpostata(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === '1';
  } catch {
    return false;
  }
}

export function ricordaPasswordImpostata(): void {
  try {
    localStorage.setItem(CHIAVE, '1');
  } catch {
    /* archivio non disponibile: l'invito ricomparirà, senza altri effetti */
  }
}
