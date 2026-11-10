-- Ricettario: schema completo (fase 0)
-- Ogni dato appartiene a una "casa"; i permessi sono nel database (RLS).

create schema if not exists private;

-- ---------- tipi ----------
create type public.unita_base as enum ('g', 'ml', 'unita');
create type public.tipo_tracciamento as enum ('quantita', 'stato');
create type public.stato_scorta as enum ('presente', 'sta_finendo', 'finito');
create type public.posizione_dispensa as enum ('dispensa', 'frigo', 'freezer');
create type public.tipo_pasto as enum ('colazione', 'pranzo', 'cena');
create type public.origine_lista as enum ('menu', 'scorta', 'manuale');
create type public.motivo_movimento as enum ('acquisto', 'ricetta', 'uso', 'buttato', 'correzione');
create type public.ruolo_membro as enum ('proprietario', 'membro');

-- ---------- case e utenti ----------
create table public.case (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  soglia_veloce_minuti int not null default 20 check (soglia_veloce_minuti > 0),
  porzioni_predefinite numeric not null default 2 check (porzioni_predefinite > 0),
  creata_il timestamptz not null default now()
);

create table public.membri (
  casa_id uuid not null references public.case (id) on delete cascade,
  utente_id uuid not null references auth.users (id) on delete cascade,
  ruolo public.ruolo_membro not null default 'membro',
  aggiunto_il timestamptz not null default now(),
  primary key (casa_id, utente_id)
);
create index membri_utente_idx on public.membri (utente_id);

-- Inviti: chi accede con questa email entra nella casa. Nessun accesso dal client.
create table public.inviti (
  email text not null,
  casa_id uuid not null references public.case (id) on delete cascade,
  ruolo public.ruolo_membro not null default 'membro',
  creato_il timestamptz not null default now(),
  primary key (email, casa_id),
  check (email = lower(email))
);
create index inviti_casa_idx on public.inviti (casa_id);

-- Case dell'utente corrente (security definer: evita la ricorsione delle policy su membri)
create function private.mie_case()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.casa_id from public.membri m where m.utente_id = (select auth.uid());
$$;

-- Alla registrazione, l'utente entra nelle case per cui esiste un invito con la sua email.
create function private.collega_inviti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.membri (casa_id, utente_id, ruolo)
    select i.casa_id, new.id, i.ruolo
    from public.inviti i
    where i.email = lower(new.email)
    on conflict do nothing;
  exception when others then
    -- un errore qui non deve mai bloccare la registrazione
    raise warning 'collega_inviti: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger collega_inviti_dopo_registrazione
after insert on auth.users
for each row execute function private.collega_inviti();

create function private.tocca_aggiornata_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornata_il := now();
  return new;
end;
$$;

-- ---------- ingredienti ----------
create table public.reparti (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  nome text not null,
  ordine int not null default 0
);
create unique index reparti_nome_idx on public.reparti (casa_id, lower(nome));

create table public.ingredienti (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  reparto_id uuid references public.reparti (id) on delete set null,
  unita_base public.unita_base not null default 'g',
  tracciamento public.tipo_tracciamento not null default 'quantita',
  durata_tipica_giorni int check (durata_tipica_giorni > 0),
  creato_il timestamptz not null default now()
);
create unique index ingredienti_nome_idx on public.ingredienti (casa_id, lower(nome));
create index ingredienti_reparto_idx on public.ingredienti (reparto_id);

create table public.alias_ingredienti (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  alias text not null check (btrim(alias) <> ''),
  ingrediente_id uuid not null references public.ingredienti (id) on delete cascade
);
create unique index alias_ingredienti_alias_idx on public.alias_ingredienti (casa_id, lower(alias));
create index alias_ingredienti_ingrediente_idx on public.alias_ingredienti (ingrediente_id);

-- ---------- ricette ----------
create table public.ricette (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  titolo text not null check (btrim(titolo) <> ''),
  reel_id text,
  reel_url text,
  autore text,
  porzioni numeric not null default 2 check (porzioni > 0),
  minuti_preparazione int check (minuti_preparazione >= 0),
  minuti_cottura int check (minuti_cottura >= 0),
  minuti_totali int generated always as (
    case when minuti_preparazione is null and minuti_cottura is null then null
         else coalesce(minuti_preparazione, 0) + coalesce(minuti_cottura, 0) end
  ) stored,
  passaggi text[] not null default '{}',
  note text,
  copertina_path text,
  da_verificare boolean not null default false,
  note_verifica text,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);
create unique index ricette_reel_idx on public.ricette (casa_id, reel_id) where reel_id is not null;
create index ricette_casa_idx on public.ricette (casa_id);
create trigger ricette_aggiornata_il before update on public.ricette
for each row execute function private.tocca_aggiornata_il();

create table public.ricetta_ingredienti (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  ricetta_id uuid not null references public.ricette (id) on delete cascade,
  ingrediente_id uuid not null references public.ingredienti (id) on delete restrict,
  quantita numeric check (quantita > 0),          -- null = q.b.
  unita public.unita_base,
  testo_originale text,
  gruppo text,
  facoltativo boolean not null default false,
  posizione int not null default 0
);
create index ricetta_ingredienti_ricetta_idx on public.ricetta_ingredienti (ricetta_id);
create index ricetta_ingredienti_ingrediente_idx on public.ricetta_ingredienti (ingrediente_id);
create index ricetta_ingredienti_casa_idx on public.ricetta_ingredienti (casa_id);

-- ---------- tag ----------
create table public.tag (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  gruppo text not null,
  ordine int not null default 0,
  colore text,
  automatico boolean not null default false    -- es. "veloce": calcolato dal tempo, non assegnato a mano
);
create unique index tag_nome_idx on public.tag (casa_id, lower(nome));

create table public.ricetta_tag (
  ricetta_id uuid not null references public.ricette (id) on delete cascade,
  tag_id uuid not null references public.tag (id) on delete cascade,
  casa_id uuid not null references public.case (id) on delete cascade,
  primary key (ricetta_id, tag_id)
);
create index ricetta_tag_tag_idx on public.ricetta_tag (tag_id);
create index ricetta_tag_casa_idx on public.ricetta_tag (casa_id);

-- ---------- menu ----------
create table public.piano_pasti (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  data date not null,
  pasto public.tipo_pasto not null,
  ricetta_id uuid references public.ricette (id) on delete set null,
  nota text,                                     -- pasto senza ricetta ("cena fuori")
  porzioni numeric check (porzioni > 0),
  cucinata_il timestamptz,
  posizione int not null default 0,
  creato_il timestamptz not null default now(),
  check (ricetta_id is not null or nota is not null)
);
create index piano_pasti_data_idx on public.piano_pasti (casa_id, data);
create index piano_pasti_ricetta_idx on public.piano_pasti (ricetta_id);

-- ---------- lista della spesa ----------
create table public.lista_spesa (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  ingrediente_id uuid references public.ingredienti (id) on delete cascade,
  testo text,                                    -- voce libera senza ingrediente
  quantita numeric check (quantita > 0),
  unita public.unita_base,
  spuntata boolean not null default false,
  spuntata_il timestamptz,
  origine public.origine_lista not null default 'manuale',
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now(),
  check (ingrediente_id is not null or testo is not null)
);
create index lista_spesa_casa_idx on public.lista_spesa (casa_id);
create index lista_spesa_ingrediente_idx on public.lista_spesa (ingrediente_id);
create trigger lista_spesa_aggiornata_il before update on public.lista_spesa
for each row execute function private.tocca_aggiornata_il();

-- ---------- prodotti e dispensa ----------
create table public.prodotti (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  codice_barre text not null check (btrim(codice_barre) <> ''),
  nome text not null,
  marca text,
  formato_quantita numeric check (formato_quantita > 0),
  formato_unita public.unita_base,
  ingrediente_id uuid not null references public.ingredienti (id) on delete restrict,
  posizione_predefinita public.posizione_dispensa not null default 'dispensa',
  creato_il timestamptz not null default now()
);
create unique index prodotti_codice_idx on public.prodotti (casa_id, codice_barre);
create index prodotti_ingrediente_idx on public.prodotti (ingrediente_id);

-- Una riga per confezione (lotto); l'app le raggruppa per ingrediente.
create table public.dispensa (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  ingrediente_id uuid not null references public.ingredienti (id) on delete restrict,
  prodotto_id uuid references public.prodotti (id) on delete set null,
  quantita numeric check (quantita >= 0),        -- per ingredienti tracciati a quantita
  stato public.stato_scorta,                     -- per ingredienti tracciati a stato
  scadenza date,
  posizione public.posizione_dispensa not null default 'dispensa',
  aperto_il date,
  aggiunto_il timestamptz not null default now(),
  esaurita_il timestamptz                        -- valorizzata quando la confezione finisce
);
create index dispensa_casa_idx on public.dispensa (casa_id) where esaurita_il is null;
create index dispensa_ingrediente_idx on public.dispensa (ingrediente_id);
create index dispensa_prodotto_idx on public.dispensa (prodotto_id);
create index dispensa_scadenza_idx on public.dispensa (casa_id, scadenza) where esaurita_il is null;

create table public.movimenti_dispensa (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.case (id) on delete cascade,
  dispensa_id uuid not null references public.dispensa (id) on delete cascade,
  variazione numeric,                            -- positiva = entrata, negativa = uscita
  stato_nuovo public.stato_scorta,
  motivo public.motivo_movimento not null,
  ricetta_id uuid references public.ricette (id) on delete set null,
  creato_il timestamptz not null default now(),
  creato_da uuid default auth.uid() references auth.users (id) on delete set null
);
create index movimenti_dispensa_dispensa_idx on public.movimenti_dispensa (dispensa_id);
create index movimenti_dispensa_casa_idx on public.movimenti_dispensa (casa_id, creato_il);
create index movimenti_dispensa_ricetta_idx on public.movimenti_dispensa (ricetta_id);
create index movimenti_dispensa_creato_da_idx on public.movimenti_dispensa (creato_da);

-- ---------- permessi ----------
grant usage on schema private to authenticated;
revoke all on function private.mie_case() from public, anon;
grant execute on function private.mie_case() to authenticated;
revoke all on function private.collega_inviti() from public, anon, authenticated;

alter table public.case enable row level security;
alter table public.membri enable row level security;
alter table public.inviti enable row level security;   -- nessuna policy: solo dal server

revoke all on public.case, public.membri, public.inviti from anon, authenticated;
grant select, update on public.case to authenticated;
grant select on public.membri to authenticated;

create policy case_lettura on public.case for select to authenticated
  using (id in (select private.mie_case()));
create policy case_modifica on public.case for update to authenticated
  using (id in (select private.mie_case()))
  with check (id in (select private.mie_case()));
create policy membri_lettura on public.membri for select to authenticated
  using (casa_id in (select private.mie_case()));

do $$
declare t text;
begin
  foreach t in array array[
    'reparti', 'ingredienti', 'alias_ingredienti', 'ricette', 'ricetta_ingredienti',
    'tag', 'ricetta_tag', 'piano_pasti', 'lista_spesa', 'prodotti', 'dispensa', 'movimenti_dispensa'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (casa_id in (select private.mie_case()))
         with check (casa_id in (select private.mie_case()))',
      t || '_casa', t);
  end loop;
end $$;
