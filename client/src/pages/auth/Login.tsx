import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthFrame from '../../components/auth/AuthFrame'
import { useAuth } from '../../auth/useAuth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    try {
      await login({
        email: String(formData.get('email')),
        password: String(formData.get('password')),
      }, formData.get('remember') === 'on')
      const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(destination, { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign-in could not be completed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame eyebrow="YOUR GREENHOUSE" title="Welcome back" description="Sign in to see how things are growing today.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></label>
        <div className="login-options">
          <label className="checkbox-label"><input type="checkbox" name="remember" /> Remember me</label>
          <span className="login-note">Password reset unavailable</span>
        </div>
        <button className="form-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <p className="auth-switch">New to VALERIA? <Link to="/register">Create an account</Link></p>
    </AuthFrame>
  )
}
