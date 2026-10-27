alter table study_requests
  add column location_id smallint references locations(location_id);


update study_requests s
set location_id = coalesce(
      (select p.location_id from profiles p where p.profile_id = s.sender_id), 6);

alter table study_requests alter column location_id set not null;

create index if not exists idx_requests_location on study_requests (location_id);


drop function if exists public.send_request(bigint, smallint, timestamptz, int, text);

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
