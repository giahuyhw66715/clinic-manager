-- ============================================================================
-- ClinicManager - Fix "500: Database error querying schema" on login
-- GoTrue scans these auth.users columns into Go strings. When our seed inserted
-- rows directly they were left NULL, which makes login fail with
-- "converting NULL to string is unsupported". Patch the existing seed users.
-- ============================================================================

update auth.users set
  confirmation_token          = coalesce(confirmation_token, ''),
  recovery_token              = coalesce(recovery_token, ''),
  email_change                = coalesce(email_change, ''),
  email_change_token_new      = coalesce(email_change_token_new, ''),
  email_change_token_current  = coalesce(email_change_token_current, ''),
  phone_change                = coalesce(phone_change, ''),
  phone_change_token          = coalesce(phone_change_token, '')
where email like '%@clinic.test';

-- Verify what gotrue will scan for the doctor account
select email, confirmation_token, recovery_token, email_change,
       email_change_token_new is null as token_new_null,
       email_change_token_current is null as token_cur_null
from auth.users
where email like '%@clinic.test'
order by email;