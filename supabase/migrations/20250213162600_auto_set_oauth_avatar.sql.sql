create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, profile_picture)
  values (new.id, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;