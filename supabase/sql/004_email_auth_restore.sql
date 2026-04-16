alter table public.profiles
  drop constraint if exists username_length;

alter table public.profiles
  drop constraint if exists username_format;

alter table public.profiles
  add constraint username_length check (char_length(username) between 3 and 24);

alter table public.profiles
  add constraint username_format check (username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists profiles_username_lower_idx
on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''),
      lower(split_part(new.email, '@', 1))
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
