alter table study_requests
  add column proposed_start   timestamptz,
  add column duration_minutes smallint not null default 60
      check (duration_minutes between 15 and 240);


update study_requests set proposed_start = created_at + interval '2 days'
where proposed_start is null;

alter table study_requests alter column proposed_start set not null;

drop table if exists availability cascade;

drop function if exists public.find_candidates(smallint, smallint, text, smallint, int);
drop function if exists public.send_request(bigint, smallint, text);

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
  p_duration int, p_message text default null)
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

  if exists (select 1 from study_requests s
             join request_recipients rr on rr.request_id = s.request_id
             where s.subject_id = p_subject and rr.status in ('pending', 'accepted')
               and ((s.sender_id = v_me and rr.receiver_id = p_receiver)
                 or (s.sender_id = p_receiver and rr.receiver_id = v_me))) then
    raise exception 'There is already an open request for this subject.';
  end if;

  insert into study_requests (sender_id, subject_id, proposed_start, duration_minutes, message)
  values (v_me, p_subject, p_start, p_duration, nullif(trim(p_message), ''))
  returning request_id into v_id;

  insert into request_recipients (request_id, receiver_id) values (v_id, p_receiver);
  return v_id;
end;
$$;

revoke execute on function public.send_request(bigint, smallint, timestamptz, int, text) from public, anon;
grant  execute on function public.send_request(bigint, smallint, timestamptz, int, text) to authenticated;
