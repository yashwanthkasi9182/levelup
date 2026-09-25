-- Run once in the Supabase SQL editor. No service-role key is needed by the app.
create extension if not exists pgcrypto with schema extensions;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null default 'Player' check (length(name) between 1 and 60),
 avatar text not null default 'spark' check (avatar in ('spark','moon','mountain','sun')),
 timezone text not null default 'UTC', created_at timestamptz not null default now()
);
create function public.new_player() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,name,timezone) values(new.id, left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Player'),60),case when exists(select 1 from pg_timezone_names where name=new.raw_user_meta_data->>'timezone') then new.raw_user_meta_data->>'timezone' else 'UTC' end); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_player();
insert into profiles(id,name) select id,left(coalesce(nullif(raw_user_meta_data->>'name',''),'Player'),60) from auth.users on conflict do nothing;
create table public.goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
 title text not null check(length(title) between 1 and 100), category text not null check(category in ('health','career','personal')),
 reason text not null default '' check(length(reason)<=500), milestone text not null check(length(milestone) between 1 and 200),
 action text not null check(length(action) between 1 and 200), small_action text not null check(length(small_action) between 1 and 200),
 cue text not null default '' check(length(cue)<=200), days integer[] not null default '{1,2,3,4,5}',
 unit text not null default 'minutes' check(length(unit) between 1 and 30), target numeric not null default 20 check(target>0 and target<=1000000),
 shared boolean not null default false, archived boolean not null default false, achieved boolean not null default false,
 created_at timestamptz not null default now(), check(cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6])
);
create function public.limit_goals() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from profiles where id=new.user_id for update;
 if not new.archived and (select count(*) from goals where user_id=new.user_id and not archived and id<>new.id)>=3 then raise exception 'You can have three active goals. Archive one to make room.'; end if;
 return new;
end $$;
create trigger goal_limit before insert or update on goals for each row execute function public.limit_goals();
create table public.checkins (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
 goal_id uuid not null references goals on delete cascade, day date not null,
 status text not null check(status in ('full','small','skipped')), quantity numeric not null default 0 check(quantity>=0 and quantity<=1000000),
 shared_note text not null default '' check(length(shared_note)<=2000),
 xp integer generated always as (case status when 'full' then 20 when 'small' then 10 else 0 end) stored,
 created_at timestamptz not null default now(), unique(goal_id,day)
);
-- Private notes are physically separate: partner reads cannot expose these columns.
create table public.notes(checkin_id uuid primary key references checkins on delete cascade,user_id uuid not null references profiles on delete cascade,body text not null check(length(body)<=2000));
create table public.partners(user_id uuid primary key references profiles on delete cascade,partner_id uuid not null unique references profiles on delete cascade,check(user_id<>partner_id));
create table public.invites(token uuid primary key default gen_random_uuid(),user_id uuid not null unique references profiles on delete cascade,expires_at timestamptz not null default now()+interval '7 days');
create table public.reactions(checkin_id uuid not null references checkins on delete cascade,user_id uuid not null references profiles on delete cascade,emoji text not null check(emoji in ('❤️','🔥','👏','💪')),created_at timestamptz not null default now(),seen boolean not null default false,primary key(checkin_id,user_id));
create table public.ai_usage(user_id uuid not null references profiles on delete cascade,day date not null default current_date,uses integer not null default 1,primary key(user_id,day));
create index goals_owner on goals(user_id); create index checkins_owner_day on checkins(user_id,day desc);
create function public.is_partner(other uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from partners where user_id=auth.uid() and partner_id=other) $$;
create function public.can_read_checkin(cid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from checkins c join goals g on g.id=c.goal_id where c.id=cid and (c.user_id=auth.uid() or (g.shared and is_partner(c.user_id)))) $$;
alter table profiles enable row level security; alter table goals enable row level security; alter table checkins enable row level security; alter table notes enable row level security; alter table partners enable row level security; alter table invites enable row level security; alter table reactions enable row level security; alter table ai_usage enable row level security;
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or is_partner(id));
create policy profile_edit on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy goal_read on goals for select to authenticated using(user_id=auth.uid() or (shared and is_partner(user_id)));
create policy goal_insert on goals for insert to authenticated with check(user_id=auth.uid());
create policy goal_edit on goals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy checkin_read on checkins for select to authenticated using(user_id=auth.uid() or exists(select 1 from goals g where g.id=goal_id and g.shared and is_partner(g.user_id)));
create policy notes_read on notes for select to authenticated using(user_id=auth.uid());
create policy partner_read on partners for select to authenticated using(user_id=auth.uid());
create policy invite_read on invites for select to authenticated using(user_id=auth.uid());
create policy reaction_read on reactions for select to authenticated using(can_read_checkin(checkin_id));
-- Writes to check-ins, notes, connections and reactions use constrained atomic RPCs.
create function public.log_quest(gid uuid, log_day date, result text, amount numeric, note text, share_note boolean) returns void language plpgsql security definer set search_path=public as $$
declare g goals; cid uuid; tz text;
begin
 select * into g from goals where id=gid and user_id=auth.uid();
 if not found then raise exception 'Goal not found'; end if;
 select timezone into tz from profiles where id=auth.uid();
 if log_day > (now() at time zone tz)::date or log_day < (g.created_at at time zone tz)::date then raise exception 'Choose a date between goal creation and today'; end if;
 if not exists(select 1 from checkins where goal_id=gid and day=log_day) and (g.archived or not extract(dow from log_day)::int=any(g.days)) then raise exception 'This quest is not scheduled for that day'; end if;
 insert into checkins(user_id,goal_id,day,status,quantity,shared_note) values(auth.uid(),gid,log_day,result,case when result='skipped' then 0 else amount end,case when share_note and g.shared then note else '' end)
 on conflict(goal_id,day) do update set status=excluded.status,quantity=excluded.quantity,shared_note=excluded.shared_note returning id into cid;
 insert into notes(checkin_id,user_id,body) values(cid,auth.uid(),note) on conflict(checkin_id) do update set body=excluded.body;
end $$;
create function public.create_invite() returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform 1 from profiles where id=auth.uid() for update;
 if exists(select 1 from partners where user_id=auth.uid()) then raise exception 'Disconnect your current partner first'; end if;
 insert into invites(user_id) values(auth.uid()) on conflict(user_id) do update set token=gen_random_uuid(),expires_at=now()+interval '7 days' returning token into t; return t;
end $$;
create function public.accept_invite(code uuid) returns void language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select user_id into owner from invites where token=code and expires_at>now();
 if owner is null or owner=auth.uid() then raise exception 'This invitation is invalid, expired, or belongs to you'; end if;
 perform 1 from profiles where id in (owner,auth.uid()) order by id for update;
 if not exists(select 1 from invites where token=code and user_id=owner and expires_at>now()) then raise exception 'Invitation expired'; end if;
 if exists(select 1 from partners where user_id in(owner,auth.uid())) then raise exception 'One of you already has a partner'; end if;
 insert into partners values(owner,auth.uid()),(auth.uid(),owner); delete from invites where user_id in(owner,auth.uid());
end $$;
create function public.disconnect_partner() returns void language plpgsql security definer set search_path=public as $$
begin delete from partners where user_id=auth.uid() or partner_id=auth.uid(); delete from invites where user_id=auth.uid(); end $$;
create function public.react_to(cid uuid, reaction text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from checkins c join goals g on g.id=c.goal_id where c.id=cid and g.shared and is_partner(c.user_id)) then raise exception 'This entry is not shared with you'; end if;
 if reaction is null then delete from reactions where checkin_id=cid and user_id=auth.uid(); else
 insert into reactions(checkin_id,user_id,emoji) values(cid,auth.uid(),reaction) on conflict(checkin_id,user_id) do update set emoji=excluded.emoji,created_at=now(),seen=false; end if;
end $$;
create function public.mark_reactions_seen() returns void language sql security definer set search_path=public as $$ update reactions set seen=true where checkin_id in(select id from checkins where user_id=auth.uid()) $$;
create function public.consume_ai_request() returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.uid() is null then return false; end if;
 insert into ai_usage(user_id) values(auth.uid()) on conflict(user_id,day) do update set uses=ai_usage.uses+1 where ai_usage.uses<10 returning uses into n; return n is not null;
end $$;
revoke all on profiles,goals,checkins,notes,partners,invites,reactions,ai_usage from anon;
grant select,update on profiles to authenticated;
grant select,insert,update on goals to authenticated;
grant select on checkins,notes,partners,invites,reactions to authenticated;
revoke all on checkins,notes,partners,invites,reactions,ai_usage from authenticated;
grant select on checkins,notes,partners,invites,reactions to authenticated;
revoke execute on function public.new_player(),public.limit_goals(),public.is_partner(uuid),public.can_read_checkin(uuid),public.log_quest(uuid,date,text,numeric,text,boolean),public.create_invite(),public.accept_invite(uuid),public.disconnect_partner(),public.react_to(uuid,text),public.mark_reactions_seen(),public.consume_ai_request() from public,anon;
grant execute on function public.is_partner(uuid),public.can_read_checkin(uuid),public.log_quest(uuid,date,text,numeric,text,boolean),public.create_invite(),public.accept_invite(uuid),public.disconnect_partner(),public.react_to(uuid,text),public.mark_reactions_seen(),public.consume_ai_request() to authenticated;

create function public.validate_timezone() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid timezone'; end if;
 return new;
end $$;
create trigger profile_timezone before insert or update of timezone on profiles for each row execute function public.validate_timezone();
revoke execute on function public.validate_timezone() from public,anon,authenticated;
