import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PublicHeader from '../layout/PublicHeader'

type AuthFrameProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export default function AuthFrame({ eyebrow, title, description, children }: AuthFrameProps) {
  return (
    <div className="page-shell">
      <PublicHeader />
      <main className="auth-page">
        <section className="auth-photo" aria-label="Greenhouse at morning light">
          <div className="auth-photo-note">
            <span>VALERIA FIELD NOTES</span>
            <p>Healthy plants.<br />A smarter tomorrow.</p>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <div className="page-eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
            <p className="auth-description">{description}</p>
            {children}
            <Link to="/" className="auth-back-link">← Back to home</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
