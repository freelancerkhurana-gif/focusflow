import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xynmrsssavljlfzvotmk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bm1yc3NzYXZsamxmenZvdG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTk4NjQsImV4cCI6MjA5NDk3NTg2NH0.a9GC5iNuBjMiP971Vp1SCfKD-uQKltkHHrdl9ne2Z_M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)