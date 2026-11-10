-- Fase 1: unione dei tag, correzione delle ricette dall'app, foto di copertina, icone degli ingredienti.

-- Icona dell'ingrediente: per ora un'emoji, usata anche come chiave se in futuro si passa a icone disegnate.
alter table public.ingredienti add column icona text;

-- Unisce un tag in un altro: le ricette del primo passano al secondo, poi il primo sparisce.
create function public.unisci_tag(p_da uuid, p_verso uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_da = p_verso then
    raise exception 'unisci_tag: i due tag coincidono';
  end if;
  if not exists (
    select 1 from public.tag a join public.tag b on b.casa_id = a.casa_id
    where a.id = p_da and b.id = p_verso and not a.automatico and not b.automatico
  ) then
    raise exception 'unisci_tag: tag non trovati, di case diverse o automatici';
  end if;
  insert into public.ricetta_tag (ricetta_id, tag_id, casa_id)
  select rt.ricetta_id, p_verso, rt.casa_id from public.ricetta_tag rt where rt.tag_id = p_da
  on conflict do nothing;
  delete from public.tag where id = p_da;
end;
$$;

-- Correzione di una ricetta dall'app, in un'unica operazione.
-- p: { titolo?, porzioni?, minuti_preparazione?, minuti_cottura?, da_verificare?,
--      tag?: [uuid], quantita?: [{ id: uuid di ricetta_ingredienti, quantita: numero o null }] }
create function public.correggi_ricetta(p_ricetta uuid, p jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_casa uuid;
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

revoke all on function public.unisci_tag(uuid, uuid) from public, anon;
revoke all on function public.correggi_ricetta(uuid, jsonb) from public, anon;
grant execute on function public.unisci_tag(uuid, uuid) to authenticated;
grant execute on function public.correggi_ricetta(uuid, jsonb) to authenticated;

-- Foto di copertina: spazio privato, una cartella per casa (<casa_id>/<file>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('copertine', 'copertine', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy copertine_lettura on storage.objects for select to authenticated
  using (bucket_id = 'copertine' and (storage.foldername(name))[1] in (select c::text from private.mie_case() c));
create policy copertine_aggiunta on storage.objects for insert to authenticated
  with check (bucket_id = 'copertine' and (storage.foldername(name))[1] in (select c::text from private.mie_case() c));
create policy copertine_modifica on storage.objects for update to authenticated
  using (bucket_id = 'copertine' and (storage.foldername(name))[1] in (select c::text from private.mie_case() c))
  with check (bucket_id = 'copertine' and (storage.foldername(name))[1] in (select c::text from private.mie_case() c));
create policy copertine_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'copertine' and (storage.foldername(name))[1] in (select c::text from private.mie_case() c));

-- Icone dei primi ingredienti (provvisorie).
update public.ingredienti i set icona = x.icona
from (values
  ('burger di seitan', '🍔'), ('vino rosso', '🍷'), ('brodo vegetale', '🍲'), ('salsa di soia', '🍶'),
  ('concentrato di pomodoro', '🍅'), ('cipolla', '🧅'), ('carote', '🥕'), ('sedano', '🥬'),
  ('timo', '🌿'), ('salvia', '🌿'), ('noce moscata', '🌰'), ('sale', '🧂'),
  ('olio extravergine d''oliva', '🫒'), ('patate', '🥔'), ('latte di soia senza zucchero', '🥛'),
  ('noci sgusciate', '🌰'), ('castagne cotte', '🌰'), ('funghi portobello', '🍄'),
  ('funghi porcini secchi', '🍄'), ('olio di semi', '🌻'), ('aromi per arrosto', '🌿'),
  ('vino bianco', '🥂'), ('tagliatelle di semola', '🍝')
) as x(nome, icona)
where i.nome = x.nome;
