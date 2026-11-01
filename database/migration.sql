create table locations (
  location_id  smallint generated always as identity primary key,
  name         text not null unique
);

insert into locations (name) values
  ('Main library'),
  ('Student center'),
  ('Cafeteria'),
  ('Dormitory'),
  ('Faculty building'),
  ('Online only');

alter table locations enable row level security;



alter table profiles
  add column study_format text not null default 'hybrid'
      check (study_format in ('in_person', 'online', 'hybrid')),
  add column location_id  smallint references locations(location_id),
  alter column faculty_id  drop not null,
  alter column study_year  drop not null;


update profiles
set study_format = (array['in_person', 'online', 'hybrid'])[1 + (profile_id % 3)::int];

update profiles
set location_id = case
      when study_format = 'online' then 6
      else 1 + (profile_id % 5)::int
    end;


alter table study_requests add column location_id smallint references locations(location_id);
update study_requests s
set location_id = coalesce((select p.location_id from profiles p where p.profile_id = s.sender_id), 6);
alter table study_requests alter column location_id set not null;
create index idx_requests_location on study_requests (location_id);



create or replace function public.current_profile_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select profile_id from public.profiles where auth_user_id = auth.uid();
$$;

revoke execute on function public.current_profile_id() from public, anon;
grant  execute on function public.current_profile_id() to authenticated;



create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, full_name, email, faculty_id, study_year)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'faculty_id', '')::smallint,
    nullif(new.raw_user_meta_data->>'study_year', '')::smallint
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();



create table profile_contacts (
  profile_id         bigint primary key references profiles(profile_id) on delete cascade,
  telegram_username  text not null
                     check (telegram_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$')
);
alter table profile_contacts enable row level security;


insert into profile_contacts (profile_id, telegram_username)
select profile_id, 'student_' || profile_id from profiles;




create table notifications (
  notification_id  bigint generated always as identity primary key,
  profile_id       bigint not null references profiles(profile_id) on delete cascade,
  type             text not null check (type in ('new_request', 'request_accepted', 'request_declined')),
  request_id       bigint references study_requests(request_id) on delete cascade,
  is_read          boolean not null default false,
  created_at       timestamptz not null default now()
);
alter table notifications enable row level security;

create or replace function public.notify_on_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender bigint;
begin
  if tg_op = 'INSERT' then
    insert into notifications (profile_id, type, request_id)
    values (new.receiver_id, 'new_request', new.request_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('accepted', 'declined') then
    select sender_id into v_sender from study_requests where request_id = new.request_id;
    insert into notifications (profile_id, type, request_id)
    values (v_sender, 'request_' || new.status, new.request_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_request on study_requests;
drop trigger if exists trg_notify_on_request on request_recipients;
create trigger trg_notify_on_request
  after insert or update on request_recipients
  for each row execute function public.notify_on_request();


do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;



create table allowed_email_domains (
  domain  text primary key
);
alter table allowed_email_domains enable row level security;

create policy "auth hook reads domains" on allowed_email_domains
  for select to supabase_auth_admin using (true);

create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  user_domain text;
begin
  user_domain := lower(split_part(event->'user'->>'email', '@', 2));

  if exists (select 1 from public.allowed_email_domains where domain = user_domain) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Please sign up with your university e-mail address.',
      'http_code', 403
    )
  );
end;
$$;

grant  execute on function public.hook_restrict_signup_by_email_domain(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_by_email_domain(jsonb) from authenticated, anon, public;
grant  select  on public.allowed_email_domains to supabase_auth_admin;



create index idx_profiles_faculty        on profiles (faculty_id);
create index idx_profiles_location       on profiles (location_id);
create index idx_subjects_faculty        on subjects (faculty_id);
create index idx_profile_subjects_subj   on profile_subjects (subject_id);
create index idx_recipients_receiver     on request_recipients (receiver_id, status);
create index idx_requests_sender         on study_requests (sender_id);
create index idx_notifications_profile   on notifications (profile_id, is_read);



create or replace function public.is_sender_of(p_request bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_requests
                 where request_id = p_request and sender_id = (select current_profile_id()));
$$;

create or replace function public.is_receiver_of(p_request bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from request_recipients
                 where request_id = p_request and receiver_id = (select current_profile_id()));
$$;

create or replace function public.request_is_open(p_request bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from request_recipients
                     where request_id = p_request and status <> 'pending');
$$;


create or replace function public.are_partners(p_other bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from study_requests s
    join request_recipients rr on rr.request_id = s.request_id
    where rr.status = 'accepted'
      and ((s.sender_id = (select current_profile_id()) and rr.receiver_id = p_other)
        or (rr.receiver_id = (select current_profile_id()) and s.sender_id = p_other))
  );
$$;

revoke execute on function public.is_sender_of(bigint), public.is_receiver_of(bigint),
                           public.request_is_open(bigint), public.are_partners(bigint)
  from public, anon;
grant  execute on function public.is_sender_of(bigint), public.is_receiver_of(bigint),
                           public.request_is_open(bigint), public.are_partners(bigint)
  to authenticated;



create policy "read faculties"  on faculties for select to anon, authenticated using (true);
create policy "read locations"  on locations for select to anon, authenticated using (true);
create policy "read subjects"   on subjects  for select to authenticated using (true);


create policy "read profiles"   on profiles for select to authenticated using (true);
create policy "edit own profile" on profiles for update to authenticated
  using      (profile_id = (select current_profile_id()))
  with check (profile_id = (select current_profile_id()));


create policy "read profile_subjects" on profile_subjects for select to authenticated using (true);
create policy "add own subjects"      on profile_subjects for insert to authenticated
  with check (profile_id = (select current_profile_id()));
create policy "remove own subjects"   on profile_subjects for delete to authenticated
  using (profile_id = (select current_profile_id()));


create policy "read own or partner contact" on profile_contacts for select to authenticated
  using (profile_id = (select current_profile_id()) or (select are_partners(profile_contacts.profile_id)));
create policy "add own contact"    on profile_contacts for insert to authenticated
  with check (profile_id = (select current_profile_id()));
create policy "change own contact" on profile_contacts for update to authenticated
  using      (profile_id = (select current_profile_id()))
  with check (profile_id = (select current_profile_id()));
create policy "delete own contact" on profile_contacts for delete to authenticated
  using (profile_id = (select current_profile_id()));


create policy "see my requests" on study_requests for select to authenticated
  using (sender_id = (select current_profile_id()) or (select is_receiver_of(request_id)));
create policy "send request as myself" on study_requests for insert to authenticated
  with check (sender_id = (select current_profile_id()));
create policy "sender cancels open request" on study_requests for delete to authenticated
  using (sender_id = (select current_profile_id()) and (select request_is_open(request_id)));

create policy "see my recipients" on request_recipients for select to authenticated
  using (receiver_id = (select current_profile_id()) or (select is_sender_of(request_id)));
create policy "sender adds recipient" on request_recipients for insert to authenticated
  with check ((select is_sender_of(request_id)) and status = 'pending'
              and receiver_id <> (select current_profile_id()));
create policy "receiver answers request" on request_recipients for update to authenticated
  using      (receiver_id = (select current_profile_id()) and status = 'pending')
  with check (receiver_id = (select current_profile_id()) and status in ('accepted', 'declined'));


create policy "see my notifications" on notifications for select to authenticated
  using (profile_id = (select current_profile_id()));
create policy "mark my notifications read" on notifications for update to authenticated
  using      (profile_id = (select current_profile_id()))
  with check (profile_id = (select current_profile_id()));


create table passes (
  profile_id         bigint   not null references profiles(profile_id) on delete cascade,
  passed_profile_id  bigint   not null references profiles(profile_id) on delete cascade,
  subject_id         smallint not null references subjects(subject_id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (profile_id, passed_profile_id, subject_id),
  check (profile_id <> passed_profile_id)
);
alter table passes enable row level security;

create policy "see my passes"    on passes for select to authenticated
  using (profile_id = (select current_profile_id()));
create policy "add my passes"    on passes for insert to authenticated
  with check (profile_id = (select current_profile_id()));
create policy "remove my passes" on passes for delete to authenticated
  using (profile_id = (select current_profile_id()));


create or replace function public.find_candidates(
  p_subject_id  smallint,
  p_location_id smallint default null,
  p_format      text     default null,
  p_limit       int      default 30
)
returns table (
  profile_id bigint, full_name text, study_year smallint, bio text,
  faculty_name text, location_name text, study_format text, shared_subjects int
)
language sql
stable
as $$
  select
    p.profile_id, p.full_name, p.study_year, p.bio,
    f.name, l.name, p.study_format,
    (select count(*)::int from profile_subjects a
       join profile_subjects b on b.subject_id = a.subject_id
      where a.profile_id = p.profile_id
        and b.profile_id = (select current_profile_id())) as shared_subjects
  from profiles p
  left join faculties f on f.faculty_id  = p.faculty_id
  left join locations l on l.location_id = p.location_id
  where p.profile_id <> (select current_profile_id())
    and exists (select 1 from profile_subjects ps
                 where ps.profile_id = p.profile_id and ps.subject_id = p_subject_id)
    and (p_location_id is null or p.location_id = p_location_id)
    and (p_format is null or p.study_format = p_format)
    and not exists (select 1 from passes x
                 where x.profile_id = (select current_profile_id())
                   and x.passed_profile_id = p.profile_id and x.subject_id = p_subject_id)
    and not exists (select 1 from study_requests r
                 join request_recipients rr on rr.request_id = r.request_id
                 where r.subject_id = p_subject_id and rr.status in ('pending', 'accepted')
                   and ((r.sender_id = (select current_profile_id()) and rr.receiver_id = p.profile_id)
                     or (rr.receiver_id = (select current_profile_id()) and r.sender_id = p.profile_id)))
  order by shared_subjects desc, p.full_name
  limit least(p_limit, 50);
$$;

revoke execute on function public.find_candidates(smallint, smallint, text, int) from public, anon;
grant  execute on function public.find_candidates(smallint, smallint, text, int) to authenticated;


create or replace function public.send_request(
  p_receiver bigint, p_subject smallint, p_start timestamptz,
  p_duration int, p_location smallint, p_message text default null)
returns bigint
language plpgsql
as $$
declare
  v_me bigint := (select current_profile_id());
  v_id bigint;
begin
  if v_me is null then raise exception 'You must be logged in.'; end if;
  if p_receiver = v_me then raise exception 'You cannot send a request to yourself.'; end if;
  if p_start is null or p_start < now() then
    raise exception 'Choose a date and time in the future.';
  end if;
  if p_duration not between 15 and 240 then
    raise exception 'The session must last between 15 minutes and 4 hours.';
  end if;
  if p_location is null then raise exception 'Choose a meeting place.'; end if;

  if exists (select 1 from study_requests s
             join request_recipients rr on rr.request_id = s.request_id
             where s.subject_id = p_subject and rr.status in ('pending', 'accepted')
               and ((s.sender_id = v_me and rr.receiver_id = p_receiver)
                 or (s.sender_id = p_receiver and rr.receiver_id = v_me))) then
    raise exception 'There is already an open request for this subject.';
  end if;

  insert into study_requests
    (sender_id, subject_id, proposed_start, duration_minutes, location_id, message)
  values
    (v_me, p_subject, p_start, p_duration, p_location, nullif(trim(p_message), ''))
  returning request_id into v_id;

  insert into request_recipients (request_id, receiver_id) values (v_id, p_receiver);
  return v_id;
end;
$$;

revoke execute on function public.send_request(bigint, smallint, timestamptz, int, smallint, text) from public, anon;
grant  execute on function public.send_request(bigint, smallint, timestamptz, int, smallint, text) to authenticated;

