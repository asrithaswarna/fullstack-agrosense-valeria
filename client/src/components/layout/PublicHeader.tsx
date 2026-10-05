import { Link } from 'react-router-dom'

export default function PublicHeader() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand-block" aria-label="VALERIA home">
          <span className="brand-name">VALERIA</span>
        </Link>
        <nav className="nav" aria-label="Main navigation">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/#features" className="nav-link">Features</Link>
          <Link to="/#about" className="nav-link">About</Link>
          <Link to="/login" className="nav-link">Login</Link>
          <Link to="/register" className="nav-link">Register</Link>
        </nav>
      </div>
    </header>
  )
}
