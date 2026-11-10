-- I passaggi diventano un elenco di {gruppo?, testo}: una ricetta puo' avere piu' preparazioni
-- (es. "Per il brasato", "Per il pure'"). Nuovo reparto per tofu, seitan e simili.

alter table public.ricette drop column passaggi;
alter table public.ricette add column passaggi jsonb not null default '[]'::jsonb
  check (jsonb_typeof(passaggi) = 'array');

insert into public.reparti (casa_id, nome, ordine)
select c.id, 'Proteine vegetali', 35 from public.case c
on conflict do nothing;

create or replace function public.importa_ricetta(p_casa uuid, p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ricetta uuid;
  v_reel text := nullif(btrim(p->>'reel_id'), '');
  v_passaggi jsonb;
  v_porzioni numeric;
  v_item jsonb;
  v_pos int;
  v_nome text;
  v_ing uuid;
  v_base public.unita_base;
  v_unita public.unita_base;
  v_quantita numeric;
  v_reparto uuid;
  v_tag text;
  v_tag_id uuid;
  v_auto boolean;
begin
  if nullif(btrim(p->>'titolo'), '') is null then
    raise exception 'importa_ricetta: titolo mancante';
  end if;

  select c.porzioni_predefinite into v_porzioni from public.case c where c.id = p_casa;
  if not found then
    raise exception 'importa_ricetta: casa % inesistente o non accessibile', p_casa;
  end if;
  v_porzioni := coalesce((p->>'porzioni')::numeric, v_porzioni);

  select coalesce(jsonb_agg(
           case when jsonb_typeof(e.v) = 'string' then jsonb_build_object('testo', e.v #>> '{}')
                else jsonb_strip_nulls(jsonb_build_object(
                       'gruppo', nullif(btrim(e.v->>'gruppo'), ''), 'testo', e.v->>'testo')) end
           order by e.n), '[]'::jsonb)
    into v_passaggi
  from jsonb_array_elements(coalesce(p->'passaggi', '[]'::jsonb)) with ordinality as e(v, n);
  if exists (select 1 from jsonb_array_elements(v_passaggi) x where nullif(btrim(x->>'testo'), '') is null) then
    raise exception 'importa_ricetta: passaggio senza testo';
  end if;

  if v_reel is not null then
    select r.id into v_ricetta from public.ricette r
    where r.casa_id = p_casa and r.reel_id = v_reel;
  end if;

  if v_ricetta is null then
    insert into public.ricette (
      casa_id, titolo, reel_id, reel_url, autore, porzioni, minuti_preparazione, minuti_cottura,
      passaggi, note, copertina_path, da_verificare, note_verifica)
    values (
      p_casa, btrim(p->>'titolo'), v_reel, p->>'reel_url', p->>'autore', v_porzioni,
      (p->>'minuti_preparazione')::int, (p->>'minuti_cottura')::int,
      v_passaggi, p->>'note', p->>'copertina_path',
      coalesce((p->>'da_verificare')::boolean, false), p->>'note_verifica')
    returning id into v_ricetta;
  else
    update public.ricette set
      titolo = btrim(p->>'titolo'),
      reel_url = p->>'reel_url',
      autore = p->>'autore',
      porzioni = v_porzioni,
      minuti_preparazione = (p->>'minuti_preparazione')::int,
      minuti_cottura = (p->>'minuti_cottura')::int,
      passaggi = v_passaggi,
      note = p->>'note',
      copertina_path = coalesce(p->>'copertina_path', copertina_path),
      da_verificare = coalesce((p->>'da_verificare')::boolean, false),
      note_verifica = p->>'note_verifica'
    where id = v_ricetta;
    delete from public.ricetta_ingredienti where ricetta_id = v_ricetta;
    delete from public.ricetta_tag where ricetta_id = v_ricetta;
  end if;

  for v_item, v_pos in
    select e.value, e.n::int
    from jsonb_array_elements(coalesce(p->'ingredienti', '[]'::jsonb)) with ordinality as e(value, n)
    order by e.n
  loop
    v_nome := nullif(btrim(v_item->>'nome'), '');
    if v_nome is null then
      raise exception 'importa_ricetta: ingrediente % senza nome', v_pos;
    end if;
    v_quantita := (v_item->>'quantita')::numeric;
    v_unita := (v_item->>'unita')::public.unita_base;

    v_ing := null;
    select i.id, i.unita_base into v_ing, v_base from public.ingredienti i
    where i.casa_id = p_casa and lower(i.nome) = lower(v_nome);

    if v_ing is null then
      select i.id, i.unita_base into v_ing, v_base
      from public.alias_ingredienti a
      join public.ingredienti i on i.id = a.ingrediente_id
      where a.casa_id = p_casa and lower(a.alias) = lower(v_nome);
    end if;

    if v_ing is null then
      v_reparto := null;
      if nullif(btrim(v_item->>'reparto'), '') is not null then
        select r.id into v_reparto from public.reparti r
        where r.casa_id = p_casa and lower(r.nome) = lower(btrim(v_item->>'reparto'));
        if v_reparto is null then
          raise exception 'importa_ricetta: reparto sconosciuto "%" (ingrediente "%")', v_item->>'reparto', v_nome;
        end if;
      end if;
      v_base := coalesce(v_unita, 'g');
      insert into public.ingredienti (casa_id, nome, reparto_id, unita_base, tracciamento)
      values (p_casa, lower(v_nome), v_reparto, v_base,
              coalesce((v_item->>'tracciamento')::public.tipo_tracciamento, 'quantita'))
      returning id into v_ing;
    end if;

    if v_quantita is not null and coalesce(v_unita, v_base) <> v_base then
      raise exception 'importa_ricetta: "%" va espresso in % (ricevuto %)', v_nome, v_base, v_unita;
    end if;

    insert into public.ricetta_ingredienti (
      casa_id, ricetta_id, ingrediente_id, quantita, unita, testo_originale, gruppo, facoltativo, posizione)
    values (
      p_casa, v_ricetta, v_ing, v_quantita,
      case when v_quantita is null then null else v_base end,
      v_item->>'testo_originale', nullif(btrim(v_item->>'gruppo'), ''),
      coalesce((v_item->>'facoltativo')::boolean, false), v_pos);
  end loop;

  for v_tag in
    select distinct btrim(t) from jsonb_array_elements_text(coalesce(p->'tag', '[]'::jsonb)) as t
  loop
    v_tag_id := null;
    select t.id, t.automatico into v_tag_id, v_auto from public.tag t
    where t.casa_id = p_casa and lower(t.nome) = lower(v_tag);
    if v_tag_id is null then
      raise exception 'importa_ricetta: tag sconosciuto "%"', v_tag;
    end if;
    if not v_auto then
      insert into public.ricetta_tag (ricetta_id, tag_id, casa_id) values (v_ricetta, v_tag_id, p_casa);
    end if;
  end loop;

  return v_ricetta;
end;
$$;
