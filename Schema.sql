drop table if exists study_requests, availability, profile_subjects, subjects, profiles, faculties cascade;


create table faculties (
  faculty_id  smallint generated always as identity primary key,
  name        text not null unique
);


create table subjects (
  subject_id  smallint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  faculty_id  smallint not null references faculties(faculty_id)
);


create table profiles (
  profile_id    bigint generated always as identity primary key,
  auth_user_id  uuid unique,            -- later: link to the Supabase Auth user
  full_name     text not null,
  email         text not null unique check (email like '%@%'),
  faculty_id    smallint not null references faculties(faculty_id),
  study_year    smallint not null check (study_year between 1 and 6),
  bio           text,
  created_at    timestamptz not null default now()
);


create table profile_subjects (
  profile_id  bigint   not null references profiles(profile_id) on delete cascade,
  subject_id  smallint not null references subjects(subject_id) on delete cascade,
  primary key (profile_id, subject_id)
);


create table availability (
  availability_id  bigint generated always as identity primary key,
  profile_id       bigint   not null references profiles(profile_id) on delete cascade,
  day_of_week      smallint not null check (day_of_week between 1 and 7),
  start_time       time     not null,
  end_time         time     not null,
  check (end_time > start_time),
  unique (profile_id, day_of_week, start_time)
);


create table study_requests (
  request_id   bigint generated always as identity primary key,
  sender_id    bigint   not null references profiles(profile_id) on delete cascade,
  receiver_id  bigint   not null references profiles(profile_id) on delete cascade,
  subject_id   smallint not null references subjects(subject_id),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  message      text,
  created_at   timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
