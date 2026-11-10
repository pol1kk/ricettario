-- Inviti dall'app: solo il proprietario invita; tutti i membri vedono chi fa parte della casa.
-- (Applicata il 10/11/2026; in produzione conteneva anche l'inserimento del primo invito.)

create function public.invita_in_casa(p_casa uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_utente uuid;
begin
  if not exists (
    select 1 from public.membri m
    where m.casa_id = p_casa and m.utente_id = (select auth.uid()) and m.ruolo = 'proprietario'
  ) then
    raise exception 'Solo chi gestisce la casa può invitare altre persone';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Indirizzo email non valido';
  end if;

  select u.id into v_utente from auth.users u where lower(u.email) = v_email;
  if v_utente is not null then
    -- ha già un account: entra subito nella casa
    insert into public.membri (casa_id, utente_id, ruolo) values (p_casa, v_utente, 'membro')
    on conflict do nothing;
    return 'aggiunto';
  end if;

  insert into public.inviti (email, casa_id, ruolo) values (v_email, p_casa, 'membro')
  on conflict do nothing;
  return 'invitato';
end;
$$;

create function public.persone_casa(p_casa uuid)
returns table (email text, ruolo public.ruolo_membro, in_attesa boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, m.ruolo, false
  from public.membri m join auth.users u on u.id = m.utente_id
  where m.casa_id = p_casa and p_casa in (select private.mie_case())
  union all
  select i.email, i.ruolo, true
  from public.inviti i
  where i.casa_id = p_casa and p_casa in (select private.mie_case())
    and not exists (select 1 from auth.users u where lower(u.email) = i.email);
$$;

revoke all on function public.invita_in_casa(uuid, text) from public, anon;
revoke all on function public.persone_casa(uuid) from public, anon;
grant execute on function public.invita_in_casa(uuid, text) to authenticated;
grant execute on function public.persone_casa(uuid) to authenticated;
