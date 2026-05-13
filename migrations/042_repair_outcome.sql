alter table repairs
  add column if not exists outcome text not null default 'clean';
