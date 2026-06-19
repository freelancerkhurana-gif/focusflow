import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Supabase credentials not configured',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Simple lightweight query just to keep the project active.
    // Reads 1 row from profiles table (adjust table name if different).
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Keep-alive query error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    console.log('Supabase keep-alive ping successful at', new Date().toISOString())
    return res.status(200).json({
      status: 'ok',
      pinged_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Keep-alive error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
