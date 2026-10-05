import { Link } from 'react-router-dom'
import PublicHeader from '../../components/layout/PublicHeader'

const features = [
  { title: 'Environmental monitoring', copy: 'Follow temperature, humidity, soil moisture, and light across greenhouse zones.', icon: 'monitor', accent: 'green' },
  { title: 'Alerts & irrigation insight', copy: 'Review threshold alerts, sensor health, and moisture-based watering recommendations.', icon: 'alert', accent: 'gold' },
  { title: 'History & live visibility', copy: 'Explore persisted trends and authenticated real-time updates through a MQTT-ready ingestion path.', icon: 'analytics', accent: 'mint' },
]

function Home() {
  return (
    <div className="page-shell">
      <PublicHeader />
      <main className="home-main">
        <section className="hero-block" id="about">
          <div className="hero-copy">
            <h1>
              <span className="title-line">Smarter Greenhouses.</span>
              <span className="title-line">Healthier Harvests.</span>
            </h1>
            <p className="description">
              Smart Greenhouse Environmental Intelligence for monitoring conditions, understanding
              change, and supporting better growing decisions.
            </p>
            <div className="cta-row">
              <Link to="/register" className="primary-btn">Get Started</Link>
              <a href="#features" className="secondary-btn">Learn More</a>
              <Link to="/login" className="secondary-btn">Sign in</Link>
            </div>
            <p className="simulation-note"><span aria-hidden="true" /> Current readings use stateful simulated sensors. Physical devices are a future integration.</p>
          </div>
          <div className="hero-visual" role="img" aria-label="Greenhouse plants">
            <div className="visual-frame"><div className="visual-overlay" aria-hidden="true" /></div>
          </div>
        </section>
        <section className="feature-row" id="features" aria-label="Key features">
          {features.map((feature) => (
            <article key={feature.title} className="info-card">
              <div className={`card-icon ${feature.accent}`} aria-hidden="true">
                {feature.icon === 'monitor' && <svg viewBox="0 0 24 24"><path d="M5 17.5V7.2A1.2 1.2 0 0 1 6.2 6h11.6a1.2 1.2 0 0 1 1.2 1.2v10.3M9 18.5h6M12 16v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                {feature.icon === 'alert' && <svg viewBox="0 0 24 24"><path d="M12 4.5a5 5 0 0 1 5 5v3.1c0 2.3 1.1 3.2 2 4.1H5c.9-.9 2-1.8 2-4.1V9.5a5 5 0 0 1 5-5Zm0 15a2.5 2.5 0 0 1-2.4-1.8h4.8A2.5 2.5 0 0 1 12 20Z" fill="currentColor" /></svg>}
                {feature.icon === 'analytics' && <svg viewBox="0 0 24 24"><path d="M5 18V8.5M9 18V5.5M13 18v-6M17 18V10M20 18V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </section>
        <section className="future-note" aria-label="Future sensor integration">
          <span className="future-note-kicker">BUILT FOR A CLEAR HARDWARE PATH</span>
          <p>Today, readings are simulated and can travel through direct ingestion or authenticated MQTT. Future ESP32 or Arduino sensors can use MQTT without implying that physical hardware is connected now.</p>
          <Link to="/register">Explore VALERIA <span aria-hidden="true">→</span></Link>
        </section>
      </main>
    </div>
  )
}

export default Home
