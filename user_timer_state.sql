-- Create user_timer_state table
CREATE TABLE IF NOT EXISTS public.user_timer_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timer_name TEXT,
    mode TEXT CHECK (mode IN ('pomodoro', 'shortBreak', 'longBreak')),
    secs_left INTEGER,
    total_secs INTEGER,
    cycles_done INTEGER,
    task_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_timer_state_user_id_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_timer_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own timer state" ON public.user_timer_state
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timer state" ON public.user_timer_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timer state" ON public.user_timer_state
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own timer state" ON public.user_timer_state
    FOR DELETE USING (auth.uid() = user_id);
