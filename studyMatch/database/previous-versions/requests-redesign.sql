create table request_recipients (
  request_id   bigint not null references study_requests(request_id) on delete cascade,
  receiver_id  bigint not null references profiles(profile_id) on delete cascade,
  status       text   not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  primary key (request_id, receiver_id)
);
alter table request_recipients enable row level security;

insert into request_recipients (request_id, receiver_id, status)
select request_id, receiver_id, status from study_requests;

alter table study_requests
  drop column receiver_id,
  drop column status;

select (select count(*) from study_requests)   as requests,
       (select count(*) from request_recipients) as recipients;
