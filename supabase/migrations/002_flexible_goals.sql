-- Apply AFTER 001. Additive upgrade; does not delete users or existing progress.
begin;
alter table public.profiles add column onboarding_completed_at timestamptz;
alter table public.profiles drop constraint profiles_avatar_check;
update public.profiles set avatar=case avatar when 'spark' then 'apex' when 'moon' then 'eclipse' when 'mountain' then 'crest' else 'orbit' end;
alter table public.profiles alter column avatar set default 'apex';
alter table public.profiles add constraint profiles_avatar_check check(avatar in ('apex','orbit','prism','crest','pulse','eclipse'));
alter table public.goals add column timezone text not null default 'UTC';
update public.goals g set timezone=p.timezone from public.profiles p where p.id=g.user_id;
create table public.goal_runs (
 id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.goals on delete cascade,
 user_id uuid not null references public.profiles on delete cascade, starts_on date not null, ends_on date,
 week_streak integer not null default 0, month_streak integer not null default 0,
 created_at timestamptz not null default now(), check(ends_on is null or ends_on>=starts_on)
);
create unique index one_active_run on public.goal_runs(goal_id) where ends_on is null;
create table public.goal_versions (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.goal_runs on delete cascade,
 effective_on date not null, measure text not null check(measure in ('days','quantity')),
 period text not null check(period in ('week','month')), target numeric not null check(target>0 and target<=1000000),
 unit text not null check(length(unit) between 1 and 30), unique(run_id,effective_on),
 check(measure<>'days' or (target=trunc(target) and target<=case period when 'week' then 7 else 31 end))
);
create table public.goal_periods (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.goal_runs on delete cascade,
 goal_id uuid not null references public.goals on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 version_id uuid not null references public.goal_versions, starts_on date not null, ends_on date not null,
 effective_on date not null, period text not null, measure text not null, target numeric not null, unit text not null,
 grace boolean not null, amount numeric not null default 0, achieved boolean not null default false,
 unique(run_id,effective_on), check(effective_on between starts_on and ends_on)
);
alter table public.checkins add column period_id uuid references public.goal_periods on delete cascade;
create index checkins_period on public.checkins(period_id);
create table public.bonuses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 goal_id uuid not null references public.goals on delete cascade, run_id uuid not null references public.goal_runs on delete cascade,
 period_id uuid references public.goal_periods on delete cascade,
 kind text not null check(kind in ('week','month','consistency')), period_start date not null,
 xp integer not null check(xp in (50,100)), created_at timestamptz not null default now(),
 unique(run_id,kind,period_start)
);
-- Existing check-ins retain their XP and no period membership: no retroactive bonuses.
insert into public.goal_runs(goal_id,user_id,starts_on)
 select id,user_id,(now() at time zone timezone)::date from public.goals where not archived;
insert into public.goal_versions(run_id,effective_on,measure,period,target,unit)
 select r.id,r.starts_on,'days','week',cardinality(g.days),'days' from public.goal_runs r join public.goals g on g.id=r.goal_id;

create function public.period_start(d date, kind text) returns date language sql immutable set search_path=public as $$
 select date_trunc(case kind when 'week' then 'week' else 'month' end,d::timestamp)::date
$$;
create function public.period_end(d date, kind text) returns date language sql immutable set search_path=public as $$
 select case kind when 'week' then public.period_start(d,kind)+6 else (public.period_start(d,kind)+interval '1 month - 1 day')::date end
$$;

-- Internal reconciler. Not exposed to browser roles. Rebuilds derived progress from recorded facts.
create function public.reconcile_player(uid uuid) returns void language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare g goals; r goal_runs; v goal_versions; p goal_periods; cursor_day date; last_day date; today date;
 m date; mend date; required_count integer; successes integer; ws integer; ms integer; has_success boolean; has_required boolean;
begin
 for g in select * from goals where user_id=uid loop
  today:=(now() at time zone g.timezone)::date;
  for r in select * from goal_runs where goal_id=g.id order by created_at loop
   last_day:=least(today,coalesce(r.ends_on,today));
   select max(ends_on)+1 into cursor_day from goal_periods where run_id=r.id;
   cursor_day:=coalesce(cursor_day,r.starts_on);
   while cursor_day<=last_day loop
    select * into v from goal_versions where run_id=r.id and effective_on<=cursor_day order by effective_on desc limit 1;
    if not found then raise exception 'Missing goal configuration'; end if;
    insert into goal_periods(run_id,goal_id,user_id,version_id,starts_on,ends_on,effective_on,period,measure,target,unit,grace)
    values(r.id,g.id,uid,v.id,period_start(cursor_day,v.period),period_end(cursor_day,v.period),cursor_day,v.period,v.measure,v.target,v.unit,cursor_day>period_start(cursor_day,v.period))
    on conflict(run_id,effective_on) do nothing;
    cursor_day:=period_end(cursor_day,v.period)+1;
   end loop;
   update goal_periods p set amount=coalesce((select case p.measure when 'days' then count(*) filter(where c.status='full')::numeric else coalesce(sum(c.quantity),0) end from checkins c where c.period_id=p.id),0) where run_id=r.id;
   update goal_periods set achieved=amount>=target where run_id=r.id;
   -- Insert once; retain timestamps on subsequent reconciliations. Revoke invalidated bonuses on corrections.
   delete from bonuses b where b.run_id=r.id and b.kind in ('week','month') and not exists(select 1 from goal_periods p where p.id=b.period_id and p.achieved);
   insert into bonuses(user_id,goal_id,run_id,period_id,kind,period_start,xp)
    select uid,g.id,r.id,p.id,p.period,p.starts_on,case p.period when 'week' then 50 else 100 end from goal_periods p where p.run_id=r.id and p.achieved
    on conflict(run_id,kind,period_start) do nothing;
   -- Every full eligible week ENDING in the month must succeed. Partial first weeks are excluded.
   m:=period_start(r.starts_on,'month');
   while m<=last_day loop
    mend:=period_end(m,'month');
    select count(*),count(*) filter(where achieved) into required_count,successes from goal_periods
     where run_id=r.id and period='week' and not grace and ends_on between m and mend and (r.ends_on is null or ends_on<=r.ends_on);
    if mend<today and (r.ends_on is null or r.ends_on>=mend) and required_count>0 and successes=required_count
      and not exists(select 1 from goal_periods where run_id=r.id and period='month' and effective_on<=mend and ends_on>=m) then
     insert into bonuses(user_id,goal_id,run_id,kind,period_start,xp) values(uid,g.id,r.id,'consistency',m,100) on conflict(run_id,kind,period_start) do nothing;
    else
     delete from bonuses where run_id=r.id and kind='consistency' and period_start=m;
    end if;
    m:=(m+interval '1 month')::date;
   end loop;
   ws:=0;
   for p in select * from goal_periods where run_id=r.id order by effective_on loop
    if p.period='month' then ws:=0;
    elsif p.achieved then ws:=ws+1;
    elsif not p.grace and p.ends_on<last_day then ws:=0;
    end if;
   end loop;
   ms:=0; m:=period_start(r.starts_on,'month');
   while m<=last_day loop
    mend:=period_end(m,'month');
    select exists(select 1 from bonuses where run_id=r.id and kind in ('month','consistency') and period_start=m) into has_success;
    select exists(select 1 from goal_periods where run_id=r.id and not grace and ((period='month' and starts_on=m) or (period='week' and ends_on between m and mend))) into has_required;
    if has_success then ms:=ms+1; elsif mend<last_day and has_required then ms:=0; end if;
    m:=(m+interval '1 month')::date;
   end loop;
   update goal_runs set week_streak=ws,month_streak=ms where id=r.id;
  end loop;
 end loop;
end $$;

create function public.save_player(player_name text, mark text, zone text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if length(trim(player_name)) not between 1 and 60 then raise exception 'Enter a name (1–60 characters)'; end if;
 update profiles set name=trim(player_name),avatar=mark,timezone=zone,onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=auth.uid();
 if not found then raise exception 'Player profile is missing'; end if;
end $$;

create function public.save_goal(payload jsonb, gid uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); g goals; r goal_runs; v goal_versions; p goal_periods; today date; effective date; zone text;
 m text:=payload->>'measure'; k text:=payload->>'period'; t numeric:=(payload->>'target')::numeric; u text;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 perform 1 from profiles where id=uid and onboarding_completed_at is not null for update;
 if not found then raise exception 'Create your player first'; end if;
 if m not in ('days','quantity') or k not in ('week','month') or t is null or t<=0 or t>1000000 then raise exception 'Choose a valid target'; end if;
 if m='days' and (t<>trunc(t) or t>case k when 'week' then 7 else 31 end) then raise exception 'Day target exceeds this period'; end if;
 u:=case m when 'days' then 'days' else trim(payload->>'unit') end;
 if u is null or length(u) not between 1 and 30 then raise exception 'Enter a unit'; end if;
 if gid is null then
  select timezone into zone from profiles where id=uid;
  today:=(now() at time zone zone)::date;
  insert into goals(user_id,title,category,reason,milestone,action,small_action,cue,target,unit,shared,timezone)
   values(uid,trim(payload->>'title'),payload->>'category',coalesce(payload->>'reason',''),coalesce(nullif(trim(payload->>'milestone'),''),trim(payload->>'title')),coalesce(nullif(trim(payload->>'action'),''),trim(payload->>'title')),coalesce(nullif(trim(payload->>'small_action'),''),'Take one small step'),coalesce(payload->>'cue',''),t,u,coalesce((payload->>'shared')::boolean,false),zone) returning id into gid;
  insert into goal_runs(goal_id,user_id,starts_on) values(gid,uid,today) returning * into r;
  insert into goal_versions(run_id,effective_on,measure,period,target,unit) values(r.id,today,m,k,t,u);
 else
  select * into g from goals where id=gid and user_id=uid and not archived;
  if not found then raise exception 'Active goal not found'; end if;
  perform reconcile_player(uid);
  today:=(now() at time zone g.timezone)::date;
  select * into r from goal_runs where goal_id=gid and ends_on is null;
  select * into p from goal_periods where run_id=r.id and effective_on<=today and ends_on>=today;
  effective:=p.ends_on+1;
  select * into v from goal_versions where id=p.version_id;
  if (v.measure,v.period,v.target,v.unit) is distinct from (m,k,t,u) then
   insert into goal_versions(run_id,effective_on,measure,period,target,unit) values(r.id,effective,m,k,t,u)
   on conflict(run_id,effective_on) do update set measure=excluded.measure,period=excluded.period,target=excluded.target,unit=excluded.unit;
  else delete from goal_versions where run_id=r.id and effective_on>today; end if;
  update goals set title=trim(payload->>'title'),category=payload->>'category',reason=coalesce(payload->>'reason',''),milestone=coalesce(nullif(trim(payload->>'milestone'),''),trim(payload->>'title')),action=coalesce(nullif(trim(payload->>'action'),''),trim(payload->>'title')),small_action=coalesce(nullif(trim(payload->>'small_action'),''),'Take one small step'),cue=coalesce(payload->>'cue',''),shared=coalesce((payload->>'shared')::boolean,false) where id=gid;
 end if;
 perform reconcile_player(uid); return gid;
end $$;

create function public.set_goal_archived(gid uuid, archive boolean) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); g goals; r goal_runs; v goal_versions; today date;
begin
 perform 1 from profiles where id=uid for update;
 select * into g from goals where id=gid and user_id=uid;
 if not found then raise exception 'Goal not found'; end if;
 if g.archived=archive then return; end if;
 today:=(now() at time zone g.timezone)::date;
 perform reconcile_player(uid);
 if archive then
  update goal_runs set ends_on=today where goal_id=gid and ends_on is null;
 else
  select * into r from goal_runs where goal_id=gid order by created_at desc limit 1;
  if found then select * into v from goal_versions where run_id=r.id and effective_on<=today order by effective_on desc limit 1; end if;
  insert into goal_runs(goal_id,user_id,starts_on) values(gid,uid,today) returning * into r;
  insert into goal_versions(run_id,effective_on,measure,period,target,unit) values(r.id,today,coalesce(v.measure,'days'),coalesce(v.period,'week'),coalesce(v.target,cardinality(g.days)),coalesce(v.unit,'days'));
 end if;
 update goals set archived=archive where id=gid;
 perform reconcile_player(uid);
end $$;

-- Same public signature, new flexible rules. Daily totals are replacements, not increments.
create or replace function public.log_quest(gid uuid, log_day date, result text, amount numeric, note text, share_note boolean) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); g goals; p goal_periods; r goal_runs; old checkins; cid uuid; today date; effective_status text;
begin
 perform 1 from profiles where id=uid for update;
 select * into g from goals where id=gid and user_id=uid;
 if not found then raise exception 'Goal not found'; end if;
 today:=(now() at time zone g.timezone)::date;
 if log_day is null or log_day>today then raise exception 'Choose today or an earlier date'; end if;
 if amount is null or amount<0 or amount>1000000 then raise exception 'Enter a valid total'; end if;
 perform reconcile_player(uid);
 select * into old from checkins where goal_id=gid and day=log_day;
 if found and old.period_id is null then
  -- Keep legacy records editable without granting new-period credit.
  update checkins set status=result,quantity=case result when 'skipped' then 0 else amount end,shared_note=case when share_note and g.shared then note else '' end where id=old.id returning id into cid;
 else
  if old.id is not null then select * into p from goal_periods where id=old.period_id;
  else
   select * into r from goal_runs where goal_id=gid and starts_on<=log_day and (ends_on is null or ends_on>=log_day) order by created_at desc limit 1;
   if not found then raise exception 'This goal was not active on that date'; end if;
   select * into p from goal_periods where run_id=r.id and effective_on<=log_day and ends_on>=log_day;
  end if;
  if p.id is null then raise exception 'No target exists for that date'; end if;
  effective_status:=case when p.measure='quantity' then case when amount>0 then 'full' else 'skipped' end else result end;
  insert into checkins(user_id,goal_id,day,status,quantity,shared_note,period_id)
   values(uid,gid,log_day,effective_status,case when effective_status='skipped' then 0 else amount end,case when share_note and g.shared then note else '' end,p.id)
   on conflict(goal_id,day) do update set status=excluded.status,quantity=excluded.quantity,shared_note=excluded.shared_note returning id into cid;
 end if;
 insert into notes(checkin_id,user_id,body) values(cid,uid,note) on conflict(checkin_id) do update set body=excluded.body;
 perform reconcile_player(uid);
end $$;

create function public.player_dashboard() returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); pid uuid; answer jsonb;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 select partner_id into pid from partners where user_id=uid;
 -- Stable lock ordering avoids cross-partner reconciliation deadlocks.
 perform 1 from profiles where id in (uid,pid) order by id for update;
 select partner_id into pid from partners where user_id=uid;
 perform reconcile_player(uid); if pid is not null then perform reconcile_player(pid); end if;
 select jsonb_build_object(
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from profiles p where id in(uid,pid)),
  'partner_id',pid,
  'goals',(select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object(
    'current_period',(select to_jsonb(p) from goal_periods p join goal_runs r on r.id=p.run_id where p.goal_id=g.id and r.ends_on is null and p.effective_on<=(now() at time zone g.timezone)::date and p.ends_on>=(now() at time zone g.timezone)::date limit 1),
    'run',(select to_jsonb(r) from goal_runs r where r.goal_id=g.id order by created_at desc limit 1),
    'pending',(select to_jsonb(v) from goal_versions v join goal_runs r on r.id=v.run_id where r.goal_id=g.id and r.ends_on is null and v.effective_on>(now() at time zone g.timezone)::date order by v.effective_on limit 1)
   ) order by g.created_at),'[]') from goals g where g.user_id=uid or (g.user_id=pid and g.shared)),
  'entries',(select coalesce(jsonb_agg(to_jsonb(c) order by c.day desc,c.created_at desc),'[]') from checkins c join goals g on g.id=c.goal_id where c.user_id=uid or (c.user_id=pid and g.shared)),
  'notes',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from notes n where n.user_id=uid),
  'periods',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('run_ends_on',r.ends_on) order by p.effective_on desc,r.created_at desc),'[]') from goal_periods p join goal_runs r on r.id=p.run_id join goals g on g.id=p.goal_id where g.user_id=uid or (g.user_id=pid and g.shared)),
  'bonuses',(select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]') from bonuses b join goals g on g.id=b.goal_id where b.user_id=uid or (b.user_id=pid and g.shared)),
  'reactions',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from reactions r join checkins c on c.id=r.checkin_id join goals g on g.id=c.goal_id where c.user_id=uid or (c.user_id=pid and g.shared)),
  'total_xp',coalesce((select sum(xp) from checkins where user_id=uid),0)+coalesce((select sum(xp) from bonuses where user_id=uid),0)
 ) into answer;
 return answer;
end $$;

-- Serialize disconnect with dashboard reads so a stale relationship cannot authorize data.
create or replace function public.disconnect_partner() returns void language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
 select partner_id into pid from partners where user_id=auth.uid();
 perform 1 from profiles where id in(auth.uid(),pid) order by id for update;
 delete from partners where user_id=auth.uid() or partner_id=auth.uid();
 delete from invites where user_id=auth.uid();
end $$;

alter table goal_runs enable row level security;
alter table goal_versions enable row level security;
alter table goal_periods enable row level security;
alter table bonuses enable row level security;
-- Internal data is exposed through the filtered dashboard only; no direct writes/reads.
revoke all on goal_runs,goal_versions,goal_periods,bonuses from anon,authenticated;
revoke insert,update,delete on goals from authenticated;
revoke update on profiles from authenticated;
revoke execute on function public.period_start(date,text),public.period_end(date,text),public.reconcile_player(uuid),public.save_player(text,text,text),public.save_goal(jsonb,uuid),public.set_goal_archived(uuid,boolean),public.player_dashboard() from public,anon,authenticated;
grant execute on function public.save_player(text,text,text),public.save_goal(jsonb,uuid),public.set_goal_archived(uuid,boolean),public.player_dashboard() to authenticated;
commit;
