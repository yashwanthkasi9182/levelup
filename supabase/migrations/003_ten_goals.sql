-- Allow up to ten active goals per player; archived goals do not count.
-- Keep in sync with MAX_ACTIVE_GOALS in lib/limits.ts.
create or replace function public.limit_goals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from profiles where id = new.user_id for update;

  if not new.archived and (
    select count(*) from goals
    where user_id = new.user_id
      and not archived
      and id <> new.id
  ) >= 10 then
    raise exception 'You can have ten active goals. Archive one to make room.';
  end if;

  return new;
end;
$$;
