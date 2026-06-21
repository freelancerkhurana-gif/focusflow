import { useParams, Link, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { blogPosts } from '../data/blogPosts'

export default function BlogPost() {
  const { slug } = useParams()
  const post = blogPosts.find(p => p.slug === slug)

  useEffect(() => {
    if (!post) return
    document.title = `${post.title} | Pomodoros.io` 

    let meta = document.querySelector('meta[name="description"]')
    const original = meta ? meta.getAttribute('content') : null
    if (meta) meta.setAttribute('content', post.description)

    return () => {
      if (meta && original) meta.setAttribute('content', original)
    }
  }, [post])

  if (!post) return <Navigate to="/blog" replace />

  const paragraphs = post.content.trim().split('\n\n').filter(Boolean)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0a1a',
      color: '#fff',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      padding: '40px 20px 80px',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link to="/" style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 28,
          fontWeight: 700,
          color: '#fff',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 32,
        }}>
          pomodoros<span style={{ color: 'rgba(255,255,255,0.6)' }}>.io</span>
        </Link>

        <Link to="/blog" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none' }}>
          ← All guides
        </Link>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 20, marginBottom: 8 }}>
          {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {post.readTime}
        </div>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 24 }}>
          {post.title}
        </h1>

        <div style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.82)' }}>
          {paragraphs.map((para, i) => {
            if (para.startsWith('## ')) {
              return (
                <h2 key={i} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 32, marginBottom: 12 }}>
                  {para.replace('## ', '')}
                </h2>
              )
            }
            if (para.match(/^\d+\. /)) {
              const items = para.split('\n').filter(Boolean)
              return (
                <ol key={i} style={{ paddingLeft: 20, marginBottom: 16 }}>
                  {items.map((item, j) => (
                    <li key={j} style={{ marginBottom: 6 }}>{item.replace(/^\d+\.\s*/, '')}</li>
                  ))}
                </ol>
              )
            }
            if (para.startsWith('- ')) {
              const items = para.split('\n').filter(Boolean)
              return (
                <ul key={i} style={{ paddingLeft: 20, marginBottom: 16 }}>
                  {items.map((item, j) => (
                    <li key={j} style={{ marginBottom: 6 }}>{item.replace(/^-s*/, '')}</li>
                  ))}
                </ul>
              )
            }
            return <p key={i} style={{ marginBottom: 18 }}>{para}</p>
          })}
        </div>

        <div style={{
          marginTop: 48,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: '24px 28px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to put this into practice?</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
            Start a free focus session with Pomodoros.io — no signup required.
          </div>
          <Link to="/" style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            padding: '10px 28px',
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}>
            Start Focusing →
          </Link>
        </div>

        <Link to="/blog" style={{
          display: 'inline-block',
          marginTop: 32,
          color: 'rgba(255,255,255,0.4)',
          fontSize: 13,
          textDecoration: 'none',
        }}>
          ← Back to all guides
        </Link>
      </div>
    </div>
  )
}
