begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_devices'
      and policyname = 'No direct client access to notification devices'
  ) then
    create policy "No direct client access to notification devices"
      on public.notification_devices for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_campaigns'
      and policyname = 'No direct client access to notification campaigns'
  ) then
    create policy "No direct client access to notification campaigns"
      on public.notification_campaigns for all to anon, authenticated
      using (false) with check (false);
  end if;
end;
$$;

commit;
