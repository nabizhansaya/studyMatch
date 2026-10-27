drop policy if exists "prototype read faculties"        on faculties;
drop policy if exists "prototype read subjects"         on subjects;
drop policy if exists "prototype read profiles"         on profiles;
drop policy if exists "prototype read profile_subjects" on profile_subjects;
drop policy if exists "prototype read study_requests"   on study_requests;
drop policy if exists "prototype send study_requests"   on study_requests;


revoke all on faculties, subjects, locations, profiles, profile_subjects,
              study_requests, request_responses, profile_contacts, notifications
  from anon, authenticated;


grant select on faculties, locations to anon, authenticated;

grant select on subjects                         to authenticated;
grant select, insert, delete on profile_subjects to authenticated;


grant select (profile_id, full_name, study_year, bio, faculty_id,
              location_id, created_at) on profiles to authenticated;
grant update (full_name, study_year, bio, faculty_id, location_id) on profiles to authenticated;

grant select, insert, update, delete on profile_contacts to authenticated;

grant select, insert, delete on study_requests   to authenticated;
grant select, insert, delete on request_responses to authenticated;

grant select           on notifications to authenticated;
grant update (is_read) on notifications to authenticated;
