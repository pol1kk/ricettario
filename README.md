# Ricettario

App personale per ricette (estratte dai reel), menù settimanale, lista della spesa e dispensa.

- **App**: React + TypeScript + Vite, installabile come PWA. Pubblicata con GitHub Pages a ogni push su `main`.
- **Dati**: Supabase (Postgres). In questo repository non ci sono dati né chiavi segrete: la chiave in `src/lib/supabase.ts` è quella pubblica e l'accesso è protetto dai permessi nel database.
- **Struttura del database**: `supabase/migrations/`, da eseguire in ordine per ricrearlo da zero.

## Comandi

```
npm install
npm run dev      # sviluppo in locale
npm run build    # controllo dei tipi e build in dist/
```

## Spostare l'app altrove (es. NAS)

1. Ricreare il database eseguendo i file in `supabase/migrations/` e importando l'ultimo backup.
2. Cambiare URL e chiave in `src/lib/supabase.ts`.
3. `APP_BASE=/ npm run build` e servire la cartella `dist/`.
