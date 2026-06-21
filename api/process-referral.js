import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { referrerId, referredId } = req.body

    if (!referrerId || !referredId) {
      return res.status(400).json({ error: 'referrerId and referredId are required' })
    }

    if (referrerId === referredId) {
      return res.status(400).json({ error: 'Cannot refer yourself' })
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', referredId)
      .maybeSingle()

    if (existing) {
      return res.status(200).json({ status: 'already_processed' })
    }

    await supabase.from('referrals').insert({
      referrer_id: referrerId,
      referred_id: referredId,
      status: 'completed',
    })

    const oneMonthFromNow = new Date()
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)

    for (const userId of [referrerId, referredId]) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id, status, pro_until')
        .eq('user_id', userId)
        .maybeSingle()

      if (existingSub) {
        const currentProUntil = existingSub.pro_until ? new Date(existingSub.pro_until) : new Date()
        const base = currentProUntil > new Date() ? currentProUntil : new Date()
        base.setMonth(base.getMonth() + 1)

        await supabase.from('subscriptions').update({
          status: existingSub.status === 'active' ? 'active' : 'active',
          pro_until: base.toISOString(),
          source: existingSub.status === 'active' ? 'stripe' : 'referral',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
      } else {
        await supabase.from('subscriptions').insert({
          user_id: userId,
          status: 'active',
          pro_until: oneMonthFromNow.toISOString(),
          source: 'referral',
        })
      }
    }

    return res.status(200).json({ status: 'success' })
  } catch (err) {
    console.error('Referral processing error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
