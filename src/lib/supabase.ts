import { createClient } from '@supabase/supabase-js';

// Valori pubblici per progetto: l'accesso ai dati è protetto dai permessi nel database (RLS).
// Per spostare l'app su un altro Supabase (es. sul NAS) basta cambiare queste due righe.
const SUPABASE_URL = 'https://kifgpxyikxpsdqhlookw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wGeUpYAY0H8LwT2eEGU4pw_Yu1KLsVK';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Indirizzo dell'app, usato come destinazione del link di accesso via email. */
export const APP_URL = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
