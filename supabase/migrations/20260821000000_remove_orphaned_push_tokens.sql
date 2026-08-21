-- Tokens without a profile owner cannot receive user-targeted notifications.
-- The updated app waits for a signed-in profile and will recreate these device
-- tokens with the correct owner the next time it registers for notifications.
delete from public.push_tokens
where profile_id is null;
