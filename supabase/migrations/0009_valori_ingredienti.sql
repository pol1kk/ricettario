-- Valori nutrizionali degli ingredienti (per 100 g, o per 100 ml se l'unità base è ml)
-- e peso medio di un pezzo per gli ingredienti contati a unità.
-- Servono al diario alimentare e a stimare le ricette che non dichiarano i valori.
--
-- I valori dei singoli ingredienti sono dati, non struttura: sono stati caricati il 15/11/2026
-- per i 100 ingredienti allora presenti e si trovano nel backup del database.

alter table public.ingredienti
  add column kcal_100 numeric check (kcal_100 >= 0),
  add column proteine_100 numeric check (proteine_100 >= 0),
  add column carboidrati_100 numeric check (carboidrati_100 >= 0),
  add column grassi_100 numeric check (grassi_100 >= 0),
  add column grammi_per_unita numeric check (grammi_per_unita > 0);

comment on column public.ingredienti.kcal_100 is 'Per 100 g, o per 100 ml se unita_base = ml';
comment on column public.ingredienti.grammi_per_unita is 'Peso medio di un pezzo, per gli ingredienti con unita_base = unita';

-- Stima i valori per porzione di una ricetta sommando gli ingredienti con quantità.
-- "coperti" dice quanti ingredienti con quantità hanno contribuito, "totali" quanti erano.
create function public.stima_valori_ricetta(p_ricetta uuid)
returns table (kcal numeric, proteine_g numeric, carboidrati_g numeric, grassi_g numeric, coperti integer, totali integer)
language sql
stable
set search_path = ''
as $$
  select
    round(sum(x.peso * i.kcal_100 / 100) / r.porzioni),
    round(sum(x.peso * i.proteine_100 / 100) / r.porzioni, 1),
    round(sum(x.peso * i.carboidrati_100 / 100) / r.porzioni, 1),
    round(sum(x.peso * i.grassi_100 / 100) / r.porzioni, 1),
    count(*) filter (where x.peso is not null and i.kcal_100 is not null)::integer,
    count(*)::integer
  from public.ricette r
  join public.ricetta_ingredienti ri on ri.ricetta_id = r.id and ri.quantita is not null and not ri.facoltativo
  join public.ingredienti i on i.id = ri.ingrediente_id
  cross join lateral (
    select case when i.unita_base = 'unita' then ri.quantita * i.grammi_per_unita else ri.quantita end as peso
  ) x
  where r.id = p_ricetta
  group by r.id, r.porzioni;
$$;

revoke all on function public.stima_valori_ricetta(uuid) from public, anon;
grant execute on function public.stima_valori_ricetta(uuid) to authenticated;
