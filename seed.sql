truncate table study_requests, availability, profile_subjects,
               profiles, subjects, faculties
restart identity cascade;


insert into faculties (name) values
  ('Information Technology'),
  ('Engineering'),
  ('Mathematics and Natural Sciences'),
  ('Business and Economics'),
  ('Law'),
  ('Social Sciences'),
  ('Languages and Humanities'),
  ('Medicine'),
  ('Education'),
  ('Architecture and Design');


insert into subjects (code, name, faculty_id) values
  ('CS101',  'Programming Fundamentals', 1),
  ('CS201',  'Data Structures',          1),
  ('CS220',  'Databases',                1),
  ('ENG110', 'Statics',                  2),
  ('ENG210', 'Thermodynamics',           2),
  ('ENG230', 'Circuit Analysis',         2),
  ('MATH101','Calculus I',               3),
  ('MATH201','Linear Algebra',           3),
  ('PHYS101','General Physics',          3),
  ('BUS101', 'Microeconomics',           4),
  ('BUS205', 'Financial Accounting',     4),
  ('BUS230', 'Marketing Principles',     4),
  ('LAW101', 'Introduction to Law',      5),
  ('LAW210', 'Civil Law',                5),
  ('LAW230', 'Constitutional Law',       5),
  ('SOC101', 'Introduction to Sociology',6),
  ('PSY101', 'General Psychology',       6),
  ('POL110', 'Political Science',        6),
  ('LNG101', 'Academic English',         7),
  ('LNG120', 'Academic Writing',         7),
  ('LIT110', 'World Literature',         7),
  ('MED101', 'Human Anatomy',            8),
  ('MED120', 'Biochemistry',             8),
  ('MED140', 'Physiology',               8),
  ('EDU101', 'Educational Psychology',   9),
  ('EDU120', 'Teaching Methods',         9),
  ('EDU140', 'Curriculum Design',        9),
  ('ARC101', 'Design Basics',           10),
  ('ARC120', 'Architectural History',   10),
  ('ARC140', 'Building Materials',      10);


insert into profiles (full_name, email, faculty_id, study_year, bio)
select
  fn || ' ' || ln,
  lower(fn) || '.' || lower(ln) || g || '@univ.example',
  1 + (g % 10),
  1 + floor(random() * 4)::int,
  (array[
    'Prefers morning study sessions',
    'Likes solving problems in a group',
    'Looking for exam preparation partners',
    'Happy to explain topics to others',
    'Needs help with homework and practice',
    'Wants a regular weekly study group'
  ])[1 + floor(random() * 6)::int]
from (
  select g,
    (array['Aigerim','Daniyar','Madina','Alikhan','Sofia','Amir','Elena','Timur',
           'Dana','Arman','Laura','Ivan','Maria','Omar','Zhanna','Kenji','Anna',
           'Yusuf','Leila','Daniel'])[1 + g % 20] as fn,
    (array['Seitkali','Nurlanov','Abenova','Karimov','Petrova','Ahmedov','Smirnova',
           'Bekov','Sultanova','Ismailov','Kim','Ivanov','Garcia','Hassan','Omarova',
           'Tanaka','Mukanov','Yilmaz','Rahimova','Miller'])[1 + (g + g / 20) % 20] as ln
  from generate_series(1, 120) g
) t;


insert into profile_subjects (profile_id, subject_id)
select p.profile_id,
       3 * (p.faculty_id - 1) + 1 + (p.profile_id % 3)
from profiles p;


insert into profile_subjects (profile_id, subject_id)
select p.profile_id,
       1 + (p.profile_id * 7 + 5) % 30
from profiles p
on conflict do nothing;


insert into availability (profile_id, day_of_week, start_time, end_time)
select p.profile_id,
       1 + (p.profile_id % 5),
       make_time((9 + (p.profile_id % 9))::int, 0, 0),
       make_time((11 + (p.profile_id % 9))::int, 0, 0)
from profiles p;

insert into availability (profile_id, day_of_week, start_time, end_time)
select p.profile_id,
       1 + ((p.profile_id + 2) % 5),
       make_time((10 + (p.profile_id % 8))::int, 0, 0),
       make_time((12 + (p.profile_id % 8))::int, 0, 0)
from profiles p;


insert into study_requests (sender_id, receiver_id, subject_id, status, message, created_at)
select g,
       1 + (g * 7 + 3) % 120,
       (select ps.subject_id from profile_subjects ps
         where ps.profile_id = g order by ps.subject_id limit 1),
       (array['pending','accepted','declined'])[1 + floor(random() * 3)::int],
       (array[
         'Hi! Want to study together this week?',
         'Can we prepare for the exam together?',
         'I could use help with this topic.',
         'Let us meet in the library.'
       ])[1 + floor(random() * 4)::int],
       now() - random() * interval '30 days'
from generate_series(1, 60) g;

-- Check the row counts
select 'faculties' as table_name, count(*) from faculties
union all select 'subjects',         count(*) from subjects
union all select 'profiles',         count(*) from profiles
union all select 'profile_subjects', count(*) from profile_subjects
union all select 'availability',     count(*) from availability
union all select 'study_requests',   count(*) from study_requests;
