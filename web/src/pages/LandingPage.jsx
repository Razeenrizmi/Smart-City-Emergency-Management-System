import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Camera,
  ChevronDown,
  Radio,
  ShieldAlert,
  Siren,
  TrafficCone,
  Zap,
} from 'lucide-react';
import { C } from '../theme';
import TrafficCanvas from '../components/TrafficCanvas';
import './LandingPage.css';

const MARQUEE_ITEMS = [
  'EMERGENCY GREEN WAVE',
  'AI ROAD-HAZARD DETECTION',
  'JUNCTION CAMERA TELEMETRY',
  'CRIME VEHICLE ANPR',
  'LIVE HAZARD MAP',
  'REAL-TIME SIGNAL PREEMPTION',
];

const CAPABILITIES = [
  {
    tag: 'RESPONSE',
    icon: Zap,
    accent: C.green,
    title: 'Emergency Green Wave',
    copy: 'Preempt traffic signals along a live emergency route and clear a corridor for responders as they move.',
  },
  {
    tag: 'HAZARDS',
    icon: TrafficCone,
    accent: C.orange,
    title: 'Road Hazard Detection',
    copy: 'Accelerometer-spike detection with AI photo verification, severity scoring and municipal dispatch.',
  },
  {
    tag: 'INFRASTRUCTURE',
    icon: Camera,
    accent: C.blue,
    title: 'Junction Camera Telemetry',
    copy: 'Per-junction camera density, live read-outs and per-road fault reporting straight from the signal backend.',
  },
  {
    tag: 'SURVEILLANCE',
    icon: ShieldAlert,
    accent: C.purple,
    title: 'Crime Vehicle Detection',
    copy: 'Multi-CCTV number-plate recognition, a wanted hotlist and automated intercept dispatch across the network.',
  },
];

const STATS = [
  { value: '24/7', label: 'Control Room Coverage' },
  { value: '4', label: 'Integrated Modules' },
  { value: 'LIVE', label: 'Signal Telemetry' },
  { value: 'JWT', label: 'Secured Access' },
];

const LandingPage = ({ onEnter }) => {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onScroll = () => setScrolled(el.scrollTop > 24);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToId = (id) => {
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="landing-root" ref={rootRef}>
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <header className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <div className="landing-brand" onClick={() => scrollToId('top')}>
            <span className="landing-brand-mark">
              <Activity size={20} color="#fff" />
            </span>
            <span className="landing-brand-text">
              SRMS
              <small>Smart City Emergency Management</small>
            </span>
          </div>

          <nav className="landing-nav-links">
            <button type="button" onClick={() => scrollToId('capabilities')}>Capabilities</button>
            <button type="button" onClick={() => scrollToId('network')}>Network</button>
            <button type="button" onClick={() => scrollToId('access')}>Access</button>
          </nav>

          <button type="button" className="landing-nav-cta" onClick={onEnter}>
            Enter Portal <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="landing-hero" id="top">
        <div className="landing-fallback" aria-hidden="true">
          <span className="landing-orb orb-a" />
          <span className="landing-orb orb-b" />
          <span className="landing-grid" />
        </div>

        {!videoReady && <TrafficCanvas className="landing-canvas" />}

        {!videoFailed && (
          <video
            className={`landing-video ${videoReady ? 'is-ready' : ''}`}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          >
            <source src="/traffic-hero.mp4" type="video/mp4" />
          </video>
        )}

        <div className="landing-scrim" aria-hidden="true" />
        <div className="landing-scanlines" aria-hidden="true" />

        <div className="landing-hero-inner">
          <span className="landing-eyebrow">
            <Radio size={14} /> Smart City Emergency Management System
          </span>

          <h1 className="landing-headline">
            WHEN EVERY
            <span className="landing-headline-accent">SECOND COUNTS</span>
          </h1>

          <p className="landing-sub">
            One command centre for emergency green waves, AI road-hazard detection,
            live junction telemetry and crime-vehicle surveillance — engineered for the
            moments that can&apos;t wait.
          </p>

          <div className="landing-hero-actions">
            <button type="button" className="landing-btn-primary" onClick={onEnter}>
              Enter Portal <ArrowRight size={18} />
            </button>
            <button type="button" className="landing-btn-ghost" onClick={() => scrollToId('capabilities')}>
              Explore Capabilities
            </button>
          </div>

          <div className="landing-hero-meta">
            <span><Siren size={14} /> Emergency Response</span>
            <span className="dot" />
            <span>Hazard Intelligence</span>
            <span className="dot" />
            <span>Traffic Surveillance</span>
          </div>
        </div>

        <button type="button" className="landing-scroll" onClick={() => scrollToId('capabilities')} aria-label="Scroll down">
          <ChevronDown size={18} />
        </button>
      </section>

      {/* ── Marquee ────────────────────────────────────────────────── */}
      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={`${item}-${i}`}>
              {item}
              <i />
            </span>
          ))}
        </div>
      </div>

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <section className="landing-section" id="capabilities">
        <div className="landing-section-head">
          <span className="landing-kicker">THE PLATFORM</span>
          <h2>Four disciplines. <span>One live picture</span> of the city.</h2>
          <p>
            Each module writes into a shared dark-surface console, so officers and field
            crews act on the same real-time state instead of juggling disconnected tooling.
          </p>
        </div>

        <div className="landing-cap-grid">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <article
                key={cap.title}
                className="landing-cap-card"
                style={{ '--accent': cap.accent }}
              >
                <div className="landing-cap-top">
                  <span className="landing-cap-icon">
                    <Icon size={22} />
                  </span>
                  <span className="landing-cap-tag">{cap.tag}</span>
                </div>
                <h3>{cap.title}</h3>
                <p>{cap.copy}</p>
                <span className="landing-cap-line" />
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Stats / Network ────────────────────────────────────────── */}
      <section className="landing-stats" id="network">
        <div className="landing-stats-inner">
          {STATS.map((stat) => (
            <div key={stat.label} className="landing-stat">
              <span className="landing-stat-value">{stat.value}</span>
              <span className="landing-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Access CTA ─────────────────────────────────────────────── */}
      <section className="landing-access" id="access">
        <div className="landing-access-card">
          <div className="landing-access-glow" aria-hidden="true" />
          <span className="landing-kicker">SECURE ACCESS</span>
          <h2>Ready to take command?</h2>
          <p>
            Municipal officers and field workers sign in to the SRMS portal with a single
            secured credential. No public sign-up — access is provisioned by the city.
          </p>
          <button type="button" className="landing-btn-primary" onClick={onEnter}>
            Enter Portal <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span className="landing-brand-mark small">
            <Activity size={16} color="#fff" />
          </span>
          <span>SRMS — Smart City Emergency Management</span>
        </div>
        <span className="landing-footer-meta">Emergency Green Wave · Hazard Detection · Crime Vehicle Detection</span>
      </footer>
    </div>
  );
};

export default LandingPage;
