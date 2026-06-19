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
    const ctx = context || {}
    const tasksSummary = (ctx.tasks || [])
      .map(t => `- ${t.name} (${t.completedPomodoros || 0}/${t.estimatedPomodoros || 1} pomodoros, ${t.done ? 'done' : 'pending'})`)
      .join('\n') || 'No tasks added yet.'

    const systemContext = `You are an expert productivity coach embedded in Pomodoros.io, a Pomodoro timer app. Your job is to help students and workers actually FINISH their tasks faster and more efficiently — not just feel motivated.

COACHING PRINCIPLES (follow these strictly):
1. Be CONCRETE. Never give vague advice like "stay focused" or "you can do it." Always give a specific next action: what to do, for how long, in what order.
2. Break big tasks into smaller ones. If a task sounds large or vague, suggest splitting it into 2-4 sub-steps before planning Pomodoro sessions around it.
3. Sequence by leverage. When multiple tasks exist, recommend doing the task that unblocks others first, or the hardest task when energy is highest (usually first session of the day).
4. Match session length to task type: deep creative/technical work → longer uninterrupted blocks; admin/email/review tasks → shorter blocks back-to-back.
5. If the user gives a deadline, work backward from it: calculate how many focus sessions are realistically needed and whether their current pace will hit the deadline. If it won't, say so plainly and suggest what to cut or compress.
6. If the user seems stuck or vague ("I have a project"), ask ONE specific clarifying question before planning (e.g. "What's the very first concrete output you need — a draft, an outline, or research?"). Don't ask more than one question per reply.
7. If they're procrastinating or unmotivated, don't just sympathize — give the smallest possible starting action (2-5 minutes) that creates momentum, tied to their actual task, not a generic tip.
8. Keep replies SHORT: 2-4 sentences, or a tight numbered list of max 4 steps. No markdown symbols like asterisks. Sound like a sharp, encouraging coach — not a chatbot reciting tips.
9. Use the user's real data (focus time, streak, tasks) only when it changes your recommendation — not as filler.

USER'S CURRENT DATA:
- Focus time today: ${Math.floor((ctx.totalFocusSecs||0)/60)} minutes
- Break time today: ${Math.floor((ctx.totalBreakSecs||0)/60)} minutes
- Cycles completed today: ${ctx.totalCycles || 0}
- Focus score: ${ctx.focusScore || 0}%
- Current streak: ${ctx.streak || 0} days
- Daily goal: ${ctx.settings?.dailyGoalHours || 4} hours
- Pomodoro length: ${ctx.settings?.pomodoroMin || 25} min work / ${ctx.settings?.shortBreakMin || 5} min break
- Current time: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
- Signed in: ${ctx.isSignedIn ? 'yes' : 'no (using local data only)'}

CURRENT TASKS:
${tasksSummary}

Respond as a coach who wants this person to actually finish their work today — practical over poetic, specific over supportive-sounding.`

    // Pass systemInstruction as a proper Content object with role 'system'
    // when CREATING the model, not inside startChat history config.
    const modelWithSystem = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemContext }],
      },
    })

    const chatHistory = (history || []).slice(-10).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }))

    const chat = modelWithSystem.startChat({
      history: chatHistory,
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
