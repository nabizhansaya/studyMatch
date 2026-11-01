truncate table study_requests restart identity cascade;

drop policy if exists "see my requests"             on study_requests;
drop policy if exists "send request as myself"      on study_requests;
drop policy if exists "sender cancels open request" on study_requests;
drop policy if exists "see my recipients"           on request_recipients;
drop policy if exists "sender adds recipient"       on request_recipients;
drop policy if exists "receiver answers request"    on request_recipients;

drop trigger  if exists trg_notify_on_request on request_recipients;
drop function if exists public.notify_on_request();
drop function if exists public.send_request(bigint, smallint, timestamptz, int, smallint, text);
drop function if exists public.send_request(bigint, smallint, timestamptz, int, text);
drop function if exists public.send_request(bigint, smallint, text);
drop function if exists public.find_candidates(smallint, smallint, text, int);
drop function if exists public.find_candidates(smallint, smallint, text, smallint, int);
drop function if exists public.is_receiver_of(bigint);
drop function if exists public.request_is_open(bigint);
drop table    if exists passes cascade;


alter table study_requests
  add column status text not null default 'open' check (status in ('open', 'matched'));
create index idx_requests_feed on study_requests (status, subject_id, proposed_start);


alter table request_recipients rename to request_responses;
alter table request_responses rename column receiver_id to responder_id;
alter table request_responses drop constraint if exists request_recipients_status_check;
alter table request_responses alter column status drop default;
alter table request_responses
  add constraint request_responses_status_check check (status in ('accepted', 'declined'));
alter table request_responses add column created_at timestamptz not null default now();
alter index if exists idx_recipients_receiver rename to idx_responses_responder;


alter table locations add column is_online boolean not null default false;
update locations set is_online = true where name = 'Online only';


alter table profiles drop column study_format;


create or replace function public.has_responded(p_request bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from request_responses
                 where request_id = p_request and responder_id = (select current_profile_id()));
$$;
revoke execute on function public.has_responded(bigint) from public, anon;
grant  execute on function public.has_responded(bigint) to authenticated;


create or replace function public.are_partners(p_other bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from study_requests s
    join request_responses rr on rr.request_id = s.request_id
    where rr.status = 'accepted'
      and ((s.sender_id = (select current_profile_id()) and rr.responder_id = p_other)
        or (rr.responder_id = (select current_profile_id()) and s.sender_id = p_other))
  );
$$;


create or replace function public.notify_on_response()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner bigint;
begin
  if new.status = 'accepted' then
    if tg_op = 'UPDATE' then
      if old.status = 'accepted' then return new; end if;
    end if;
    select sender_id into v_owner from study_requests where request_id = new.request_id;
    insert into notifications (profile_id, type, request_id)
    values (v_owner, 'request_accepted', new.request_id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_on_response
  after insert or update on request_responses
  for each row execute function public.notify_on_response();


create policy "see open or related requests" on study_requests for select to authenticated
  using (status = 'open'
         or sender_id = (select current_profile_id())
         or (select has_responded(request_id)));
create policy "post my request" on study_requests for insert to authenticated
  with check (sender_id = (select current_profile_id()) and status = 'open');
create policy "cancel my open request" on study_requests for delete to authenticated
  using (sender_id = (select current_profile_id()) and status = 'open');

create policy "see my responses" on request_responses for select to authenticated
  using (responder_id = (select current_profile_id()) or (select is_sender_of(request_id)));
create policy "skip a request" on request_responses for insert to authenticated
  with check (responder_id = (select current_profile_id())
              and status = 'declined'
              and not (select is_sender_of(request_id)));
create policy "undo my skip" on request_responses for delete to authenticated
  using (responder_id = (select current_profile_id()) and status = 'declined');


create or replace function public.create_request(
  p_subject smallint, p_start timestamptz, p_duration int,
  p_location smallint, p_message text default null)
returns bigint
language plpgsql
as $$
declare
  v_me bigint := (select current_profile_id());
  v_id bigint;
begin
  if v_me is null then raise exception 'You must be logged in.'; end if;
  if p_start is null or p_start < now() then
    raise exception 'Choose a date and time in the future.';
  end if;
  if p_duration not between 15 and 240 then
    raise exception 'The session must last between 15 minutes and 4 hours.';
  end if;
  if p_location is null then raise exception 'Choose a meeting place.'; end if;
  if (select count(*) from study_requests where sender_id = v_me and status = 'open') >= 5 then
    raise exception 'You already have 5 open requests. Cancel one first.';
  end if;

  insert into study_requests (sender_id, subject_id, proposed_start, duration_minutes, location_id, message)
  values (v_me, p_subject, p_start, p_duration, p_location, nullif(trim(p_message), ''))
  returning request_id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_request(smallint, timestamptz, int, smallint, text) from public, anon;
grant  execute on function public.create_request(smallint, timestamptz, int, smallint, text) to authenticated;


create or replace function public.accept_request(p_request bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me bigint := (select current_profile_id());
  v_owner bigint;
begin
  if v_me is null then raise exception 'You must be logged in.'; end if;

  update study_requests set status = 'matched'
  where request_id = p_request and status = 'open'
    and sender_id <> v_me and proposed_start > now()
  returning sender_id into v_owner;

  if v_owner is null then
    raise exception 'This request is no longer available.';
  end if;

  insert into request_responses (request_id, responder_id, status)
  values (p_request, v_me, 'accepted')
  on conflict (request_id, responder_id) do update set status = 'accepted';
end;
$$;
revoke execute on function public.accept_request(bigint) from public, anon;
grant  execute on function public.accept_request(bigint) to authenticated;


create or replace function public.find_requests(
  p_subject_id  smallint    default null,
  p_location_id smallint    default null,
  p_format      text        default null,      
  p_from        timestamptz default null,
  p_to          timestamptz default null,
  p_my_subjects boolean     default false,     
  p_limit       int         default 30
)
returns table (
  request_id bigint, owner_id bigint, owner_name text, owner_year smallint,
  owner_faculty text, subject_id smallint, subject_code text, subject_name text,
  proposed_start timestamptz, duration_minutes smallint,
  location_id smallint, location_name text, is_online boolean,
  message text, in_my_subjects boolean
)
language sql
stable
as $$
  select
    r.request_id, p.profile_id, p.full_name, p.study_year, f.name,
    s.subject_id, s.code, s.name,
    r.proposed_start, r.duration_minutes,
    l.location_id, l.name, l.is_online,
    r.message,
    exists (select 1 from profile_subjects m
             where m.profile_id = (select current_profile_id())
               and m.subject_id = r.subject_id) as in_my_subjects
  from study_requests r
  join profiles  p on p.profile_id  = r.sender_id
  join subjects  s on s.subject_id  = r.subject_id
  join locations l on l.location_id = r.location_id
  left join faculties f on f.faculty_id = p.faculty_id
  where r.status = 'open'
    and r.sender_id <> (select current_profile_id())
    and r.proposed_start > now()
    and (p_subject_id  is null or r.subject_id  = p_subject_id)
    and (p_location_id is null or r.location_id = p_location_id)
    and (p_format is null or l.is_online = (p_format = 'online'))
    and (p_from is null or r.proposed_start >= p_from)
    and (p_to   is null or r.proposed_start <  p_to)
    and (not p_my_subjects or exists (select 1 from profile_subjects m2
             where m2.profile_id = (select current_profile_id())
               and m2.subject_id = r.subject_id))
    and not exists (select 1 from request_responses x
             where x.request_id = r.request_id
               and x.responder_id = (select current_profile_id()))
  order by in_my_subjects desc, r.proposed_start
  limit least(p_limit, 50);
$$;
revoke execute on function public.find_requests(smallint, smallint, text, timestamptz, timestamptz, boolean, int) from public, anon;
grant  execute on function public.find_requests(smallint, smallint, text, timestamptz, timestamptz, boolean, int) to authenticated;


insert into study_requests (sender_id, subject_id, proposed_start, duration_minutes,
                            location_id, message, status)
select p.profile_id,
       (select ps.subject_id from profile_subjects ps
         where ps.profile_id = p.profile_id order by ps.subject_id limit 1),
       date_trunc('hour', now())
         + ((1 + (p.profile_id % 10)) * interval '1 day')
         + ((8 + (p.profile_id % 10)) * interval '1 hour'),
       (array[30, 60, 90, 120])[1 + (p.profile_id % 4)::int],
       1 + (p.profile_id % 6)::int,
       (array['Hi! Want to study together?', 'Exam preparation, anyone?',
              'Let us solve practice problems.', 'Looking for a quiet place to study.'])[1 + (p.profile_id % 4)::int],
       'open'
from profiles p
where p.auth_user_id is null and p.profile_id <= 90;


select (select count(*) from study_requests) as requests,
       (select count(*) from request_responses) as responses;
