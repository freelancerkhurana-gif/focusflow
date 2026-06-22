-- Add unique constraint on username column in profiles table
-- This ensures no two users can claim the same username

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Create index for better performance on username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
