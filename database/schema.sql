drop table if exists request_recipients, study_requests, profile_subjects,
                     subjects, profiles, faculties cascade;


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
  auth_user_id  uuid unique,            
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


create table study_requests (
  request_id   bigint generated always as identity primary key,
  sender_id    bigint   not null references profiles(profile_id) on delete cascade,
  subject_id   smallint not null references subjects(subject_id),
  proposed_start    timestamptz not null,
  duration_minutes  smallint    not null default 60 check (duration_minutes between 15 and 240),
  message      text,
  created_at   timestamptz not null default now()
);


create table request_recipients (
  request_id   bigint not null references study_requests(request_id) on delete cascade,
  receiver_id  bigint not null references profiles(profile_id) on delete cascade,
  status       text   not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  primary key (request_id, receiver_id)
);


alter table faculties        enable row level security;
alter table subjects         enable row level security;
alter table profiles         enable row level security;
alter table profile_subjects enable row level security;
alter table study_requests   enable row level security;
alter table request_recipients enable row level security;
