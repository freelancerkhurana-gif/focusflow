import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { blogPosts } from '../data/blogPosts'

export default function BlogIndex() {
  useEffect(() => {
    document.title = 'Blog - Pomodoro Technique Guides & Focus Tips | Pomodoros.io'
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0a1a',
      color: '#fff',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/" style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 32,
          fontWeight: 700,
          color: '#fff',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 40,
        }}>
          pomodoros<span style={{ color: 'rgba(255,255,255,0.6)' }}>.io</span>
        </Link>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          Focus & Productivity Guides
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 40 }}>
          Practical guides on the Pomodoro Technique, focus, and beating procrastination.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {blogPosts.map(post => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              style={{
                display: 'block',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '20px 24px',
                textDecoration: 'none',
                color: '#fff',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {post.readTime}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>
                {post.title}
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, margin: 0 }}>
                {post.description}
              </p>
            </Link>
          ))}
        </div>

        <Link to="/" style={{
          display: 'inline-block',
          marginTop: 40,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          textDecoration: 'none',
        }}>
          ← Back to the timer
        </Link>
      </div>
    </div>
  )
}
