-- Valori nutrizionali per porzione come campi della ricetta, con la loro origine.

create type public.fonte_valori as enum ('dichiarati', 'stimati');

alter table public.ricette
  add column kcal numeric check (kcal >= 0),
  add column proteine_g numeric check (proteine_g >= 0),
  add column carboidrati_g numeric check (carboidrati_g >= 0),
  add column grassi_g numeric check (grassi_g >= 0),
  add column valori_fonte public.fonte_valori;

comment on column public.ricette.kcal is 'Per porzione';
comment on column public.ricette.proteine_g is 'Grammi per porzione';
comment on column public.ricette.carboidrati_g is 'Grammi per porzione';
comment on column public.ricette.grassi_g is 'Grammi per porzione';
comment on column public.ricette.valori_fonte is 'dichiarati = presi dal reel; stimati = calcolati o convertiti';

-- correggi_ricetta accetta anche  valori: { kcal, proteine_g, carboidrati_g, grassi_g, fonte? }
create or replace function public.correggi_ricetta(p_ricetta uuid, p jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_casa uuid;
  v jsonb := p->'valori';
begin
  select r.casa_id into v_casa from public.ricette r where r.id = p_ricetta;
  if not found then
    raise exception 'correggi_ricetta: ricetta inesistente o non accessibile';
  end if;

  update public.ricette set
    titolo = coalesce(nullif(btrim(p->>'titolo'), ''), titolo),
    porzioni = coalesce((p->>'porzioni')::numeric, porzioni),
    minuti_preparazione = case when p ? 'minuti_preparazione' then (p->>'minuti_preparazione')::int else minuti_preparazione end,
    minuti_cottura = case when p ? 'minuti_cottura' then (p->>'minuti_cottura')::int else minuti_cottura end,
    da_verificare = coalesce((p->>'da_verificare')::boolean, da_verificare),
    note_verifica = case when (p->>'da_verificare')::boolean is false then null else note_verifica end
  where id = p_ricetta;

  if p ? 'valori' then
    update public.ricette set
      kcal = (v->>'kcal')::numeric,
      proteine_g = (v->>'proteine_g')::numeric,
      carboidrati_g = (v->>'carboidrati_g')::numeric,
      grassi_g = (v->>'grassi_g')::numeric,
      valori_fonte = case
        when coalesce(v->>'kcal', v->>'proteine_g', v->>'carboidrati_g', v->>'grassi_g') is null then null
        else coalesce((v->>'fonte')::public.fonte_valori, valori_fonte, 'dichiarati') end
    where id = p_ricetta;
  end if;

  if p ? 'quantita' then
    update public.ricetta_ingredienti ri set
      quantita = (x.v->>'quantita')::numeric,
      unita = case when (x.v->>'quantita') is null then null else i.unita_base end
    from jsonb_array_elements(p->'quantita') as x(v), public.ingredienti i
    where ri.id = (x.v->>'id')::uuid and ri.ricetta_id = p_ricetta and i.id = ri.ingrediente_id;
  end if;

  if p ? 'tag' then
    delete from public.ricetta_tag where ricetta_id = p_ricetta;
    insert into public.ricetta_tag (ricetta_id, tag_id, casa_id)
    select p_ricetta, t.id, v_casa from public.tag t
    where t.casa_id = v_casa and not t.automatico
      and t.id in (select x::uuid from jsonb_array_elements_text(p->'tag') as x);
  end if;
end;
$$;
