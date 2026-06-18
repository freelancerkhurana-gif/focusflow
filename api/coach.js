import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      hasApiKey: !!process.env.GEMINI_API_KEY 
    })
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, context, history } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const ctx = context || {}
    const tasksSummary = (ctx.tasks || [])
      .map(t => `- ${t.name} (${t.completedPomodoros || 0}/${t.estimatedPomodoros || 1} pomodoros, ${t.done ? 'done' : 'pending'})`)
      .join('\n') || 'No tasks added yet.'

    const systemContext = `You are a warm, practical productivity coach inside a Pomodoro timer app called Pomodoros.io. 
Keep replies SHORT (2-4 sentences max), conversational, and actionable. Never use markdown formatting like asterisks or bullet points unless listing concrete steps.

USER'S CURRENT DATA:
- Focus time today: ${Math.floor((ctx.totalFocusSecs||0)/60)} minutes
- Break time today: ${Math.floor((ctx.totalBreakSecs||0)/60)} minutes
- Cycles completed today: ${ctx.totalCycles || 0}
- Focus score: ${ctx.focusScore || 0}%
- Current streak: ${ctx.streak || 0} days
- Daily goal: ${ctx.settings?.dailyGoalHours || 4} hours
- Pomodoro length: ${ctx.settings?.pomodoroMin || 25} min work / ${ctx.settings?.shortBreakMin || 5} min break
- Signed in: ${ctx.isSignedIn ? 'yes' : 'no (using local data only)'}

CURRENT TASKS:
${tasksSummary}

Use this data naturally when relevant (e.g. "since you've already focused 40 minutes today..."). Don't recite all the stats back robotically. Focus on being genuinely helpful for planning, motivation, and beating procrastination for students and workers.`

    const chatHistory = (history || []).slice(-10).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }))

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: systemContext,
    })

    const result = await chat.sendMessage(message)
    const reply = result.response.text()

    return res.status(200).json({ reply })
  } catch (err) {
    console.error('Coach API error:', err.message, err.stack)
    return res.status(500).json({ 
      error: 'Failed to generate response', 
      detail: err.message,
      hasApiKey: !!process.env.GEMINI_API_KEY 
    })
  }
}
