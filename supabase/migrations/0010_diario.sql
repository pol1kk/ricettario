-- Diario alimentare: personale, ognuno vede e modifica solo il proprio.
-- Ricette, menù, lista e dispensa restano della casa.

-- le due merende valgono sia per il diario sia per il menù
alter type public.tipo_pasto add value if not exists 'merenda_mattino' after 'colazione';
alter type public.tipo_pasto add value if not exists 'merenda_pomeriggio' after 'pranzo';

create table public.diario (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  pasto public.tipo_pasto not null,
  -- nome e valori sono una fotografia del momento: non cambiano se poi la ricetta viene corretta
  nome text not null check (btrim(nome) <> ''),
  ricetta_id uuid references public.ricette (id) on delete set null,
  ingrediente_id uuid references public.ingredienti (id) on delete set null,
  -- voce del menù da cui è stata confermata, se viene da lì
  piano_id uuid references public.piano_pasti (id) on delete set null,
  quantita numeric check (quantita > 0),
  unita text check (unita in ('porzioni', 'g', 'ml', 'unita')),
  -- valori di quanto mangiato (non per porzione)
  kcal numeric check (kcal >= 0),
  proteine_g numeric check (proteine_g >= 0),
  carboidrati_g numeric check (carboidrati_g >= 0),
  grassi_g numeric check (grassi_g >= 0),
  creato_il timestamptz not null default now()
);

create index diario_utente_data on public.diario (utente_id, data);
create index diario_ricetta on public.diario (ricetta_id) where ricetta_id is not null;
create index diario_ingrediente on public.diario (ingrediente_id) where ingrediente_id is not null;
create index diario_piano on public.diario (piano_id) where piano_id is not null;

alter table public.diario enable row level security;
grant select, insert, update, delete on public.diario to authenticated;
create policy diario_proprio on public.diario for all to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));

-- Obiettivi giornalieri, per persona. Ogni valore è facoltativo.
-- "giorni": un obiettivo per giorno della settimana, chiavi da "1" (lunedì) a "7" (domenica).
-- "settimana": l'obiettivo unico, usato quando fissi = true.
-- Ogni obiettivo è {"kcal": n, "proteine_g": n, "carboidrati_g": n, "grassi_g": n}.
create table public.obiettivi (
  utente_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  fissi boolean not null default false,
  settimana jsonb not null default '{}'::jsonb,
  giorni jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now()
);

alter table public.obiettivi enable row level security;
grant select, insert, update, delete on public.obiettivi to authenticated;
create policy obiettivi_propri on public.obiettivi for all to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));
