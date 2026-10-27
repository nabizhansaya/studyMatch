drop policy if exists "prototype read faculties"        on faculties;
drop policy if exists "prototype read subjects"         on subjects;
drop policy if exists "prototype read profiles"         on profiles;
drop policy if exists "prototype read profile_subjects" on profile_subjects;
drop policy if exists "prototype read availability"     on availability;
drop policy if exists "prototype read study_requests"   on study_requests;
drop policy if exists "prototype send study_requests"   on study_requests;

create policy "prototype read faculties"        on faculties        for select to anon using (true);
create policy "prototype read subjects"         on subjects         for select to anon using (true);
create policy "prototype read profiles"         on profiles         for select to anon using (true);
create policy "prototype read profile_subjects" on profile_subjects for select to anon using (true);
create policy "prototype read availability"     on availability     for select to anon using (true);
create policy "prototype read study_requests"   on study_requests   for select to anon using (true);

create policy "prototype send study_requests"   on study_requests   for insert to anon with check (true);
