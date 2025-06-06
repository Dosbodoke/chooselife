create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, profile_picture, name)
  values (new.id, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing; -- Prevents errors if the profile already exists
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
