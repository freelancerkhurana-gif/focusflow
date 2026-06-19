import Stripe from 'stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, email } = req.body

    if (!userId || !email) {
      return res.status(400).json({ error: 'userId and email are required' })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: email,
      client_reference_id: userId,
      success_url: 'https://www.pomodoros.io/?upgrade=success',
      cancel_url: 'https://www.pomodoros.io/?upgrade=cancelled',
      metadata: { userId },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout creation error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
