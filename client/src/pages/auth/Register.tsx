import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthFrame from '../../components/auth/AuthFrame'
import { useAuth } from '../../auth/useAuth'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const passwordsMatch = password === confirmation

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!passwordsMatch) return

    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    try {
      await register({
        name: String(formData.get('name')),
        email: String(formData.get('email')),
        password,
        ...(String(formData.get('greenhouse') || '').trim()
          ? { greenhouseName: String(formData.get('greenhouse')).trim() }
          : {}),
      })
      navigate('/dashboard', { replace: true })
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'Registration could not be completed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame eyebrow="GET STARTED" title="Create your account" description="A few details will get your greenhouse workspace ready.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Full name<input name="name" autoComplete="name" placeholder="Your full name" required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
        <div className="form-two-columns">
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter your password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        </div>
        {confirmation && !passwordsMatch && <p className="form-error" role="alert">Those passwords do not match yet.</p>}
        <label>Greenhouse name <span className="optional-label">OPTIONAL</span><input name="greenhouse" placeholder="e.g. North Glasshouse" /></label>
        <button className="form-submit" type="submit" disabled={submitting}>{submitting ? 'Preparing account…' : 'Create my account'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthFrame>
  )
}
