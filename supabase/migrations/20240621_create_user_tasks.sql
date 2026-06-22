-- Create user_tasks table
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id text PRIMARY KEY,  -- Use text ID to match existing Date.now() task IDs
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  estimated_pomodoros integer DEFAULT 1,
  completed_pomodoros integer DEFAULT 0,
  done boolean DEFAULT false,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own tasks
CREATE POLICY "Users can manage their own tasks" ON public.user_tasks
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_last_active_at ON public.user_tasks(last_active_at);
CREATE INDEX IF NOT EXISTS idx_user_tasks_done ON public.user_tasks(done);
