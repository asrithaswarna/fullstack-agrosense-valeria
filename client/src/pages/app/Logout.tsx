import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

export default function Logout() {
  const { logout } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    void logout().catch(() => setError('You could not be signed out. Please try again.'))
  }, [logout])

  return (
    <div className="logout-page">
      <div className="logout-mark" aria-hidden="true">V</div>
      <span className="page-eyebrow">UNTIL NEXT TIME</span>
      <h1>Thank you for tending<br />to your greenhouse.</h1>
      <p>You are signed out. Your greenhouse workspace will be here when you return.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Link to="/" className="primary-btn">Return to home</Link>
    </div>
  )
}
