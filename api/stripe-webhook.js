import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', chunk => chunks.push(chunk))
    readable.on('end', () => resolve(Buffer.concat(chunks)))
    readable.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers['stripe-signature']

  let event
  try {
    const rawBody = await buffer(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  )

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.client_reference_id || session.metadata?.userId

      if (userId) {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object
      await supabase.from('subscriptions')
        .update({
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      await supabase.from('subscriptions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
