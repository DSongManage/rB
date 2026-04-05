import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// --- Escrow Flow Visualization ---
function EscrowFlowDiagram() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveStep(prev => (prev + 1) % 4), 2500);
    return () => clearInterval(interval);
  }, []);

  const stepIcons = [
    // Handshake
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
    </svg>,
    // Lock
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>,
    // Upload/file
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" />
    </svg>,
    // Zap
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>,
  ];

  const steps = [
    { label: 'Agree', sublabel: 'Set terms & milestones', icon: stepIcons[0] },
    { label: 'Fund', sublabel: 'USDC locked in escrow', icon: stepIcons[1] },
    { label: 'Deliver', sublabel: 'Upload & review work', icon: stepIcons[2] },
    { label: 'Release', sublabel: 'Instant payment', icon: stepIcons[3] },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '24px 0', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: i <= activeStep ? 1 : 0.3,
            transform: i <= activeStep ? 'scale(1)' : 'scale(0.92)',
            flex: '1 1 0', minWidth: 0,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: i === activeStep ? '#fff' : '#E8981F',
              background: i <= activeStep ? (i === activeStep ? '#E8981F' : 'rgba(232,152,31,0.12)') : 'rgba(58,54,50,0.06)',
              border: i === activeStep ? '2px solid #E8981F' : '2px solid transparent',
              boxShadow: i === activeStep ? '0 0 20px rgba(232,152,31,0.3)' : 'none',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>{step.icon}</div>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: i <= activeStep ? '#1a1816' : '#9e9a95', fontFamily: 'var(--font-body)' }}>{step.label}</div>
              <div style={{ fontSize: 11, color: i <= activeStep ? '#6b6560' : '#c5c0ba', fontFamily: 'var(--font-body)', marginTop: 2 }}>{step.sublabel}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: 20, minWidth: 12, height: 2, flexShrink: 1, marginBottom: 28, borderRadius: 1,
              background: i < activeStep ? '#E8981F' : 'rgba(58,54,50,0.12)',
              transition: 'background 0.5s ease',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Animated Stat ---
function AnimatedStat({ end, suffix = '', label }: { end: number; suffix?: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const duration = 1500;
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * end));
          if (progress < 1) requestAnimationFrame(animate);
        };
        animate();
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 800, color: '#E8981F', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{count}{suffix}</div>
      <div style={{ fontSize: 13, color: '#6b6560', marginTop: 8, fontFamily: 'var(--font-body)', letterSpacing: '0.03em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// --- SVG Icons ---
const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const PeopleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
);
const MilestoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const ZapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// --- Main Landing Page ---
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navSolid = scrollY > 40;

  const handleStartProject = () => {
    if (isAuthenticated) {
      navigate('/studio');
    } else {
      navigate('/auth', { state: { from: '/studio' } });
    }
  };

  const howItWorksSteps = [
    { num: '01', title: 'Create your project', desc: 'Name it, set milestones, define the payment. Work-for-hire, hybrid, or equity split \u2014 you choose.', icon: <MilestoneIcon /> },
    { num: '02', title: 'Share the link', desc: "Send your collaborator a link. They see the full deal \u2014 terms, milestones, money \u2014 before signing up.", icon: <LinkIcon /> },
    { num: '03', title: 'Fund & build', desc: "Writer funds each milestone. Artist sees the money locked before starting. Upload pages, review, approve.", icon: <ShieldIcon /> },
    { num: '04', title: 'Instant release', desc: "Approve the work, funds hit the artist's wallet immediately. No invoicing. No waiting. No chasing.", icon: <ZapIcon /> },
  ];

  const features = [
    { title: 'Non-custodial', desc: 'We never hold your money. Funds sit in an immutable smart contract until milestone conditions are met.' },
    { title: "3% fee. That's it.", desc: 'One simple fee on milestone releases. No hidden charges. No subscription. Free to browse and connect.' },
    { title: '72-hour auto-approve', desc: 'If a writer goes silent after delivery, funds release automatically. Artists are protected from ghosting.' },
    { title: 'Shareable deal links', desc: 'Set up a project, send a link. Your collaborator sees the full terms before they even create an account.' },
    { title: 'Completion scores', desc: 'Every finished milestone builds your reputation. Collaborators can see your track record before committing.' },
    { title: 'Pay with anything', desc: 'Card, Apple Pay, Google Pay \u2014 Coinbase converts it to USDC behind the scenes. No crypto knowledge needed.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: 'var(--font-body)', color: '#1a1816', overflowX: 'hidden' }}>
      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: navSolid ? 'rgba(250,250,248,0.92)' : 'transparent',
        backdropFilter: navSolid ? 'blur(20px)' : 'none',
        borderBottom: navSolid ? '1px solid rgba(58,54,50,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/rb-logo.png" alt="rB" style={{ height: 28 }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 500, color: '#1a1816', letterSpacing: '-0.01em' }}>renaissBlock</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="nav-links-desktop">
          {isAuthenticated ? (
            <>
              <Link to="/studio" style={{ fontSize: 14, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Studio</Link>
              <Link to="/campaigns" style={{ fontSize: 14, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Campaigns</Link>
              <Link to="/collaborators" style={{ fontSize: 14, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Creators</Link>
              <Link to="/profile" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '50%', background: '#E8981F', color: '#fff',
                textDecoration: 'none', fontSize: 14, fontWeight: 700,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
            </>
          ) : (
            <>
              <a href="#how" style={{ fontSize: 14, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>How It Works</a>
              <Link to="/campaigns" style={{ fontSize: 14, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Campaigns</Link>
              <Link to="/collaborators" style={{ fontSize: 14, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Find Creators</Link>
              <Link to="/auth" style={{ fontSize: 14, fontWeight: 700, color: '#E8981F', textDecoration: 'none' }}>Log In</Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="mobile-menu-btn"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'none', flexDirection: 'column', gap: 5 }}
        >
          <div style={{ width: 22, height: 2, background: '#1a1816', borderRadius: 1, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
          <div style={{ width: 22, height: 2, background: '#1a1816', borderRadius: 1, transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
          <div style={{ width: 22, height: 2, background: '#1a1816', borderRadius: 1, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, padding: 24,
          background: 'rgba(250,250,248,0.98)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 20,
          borderBottom: '1px solid rgba(58,54,50,0.08)',
        }}>
          {isAuthenticated ? (
            <>
              <Link to="/studio" style={{ fontSize: 16, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Studio</Link>
              <Link to="/store" style={{ fontSize: 16, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Store</Link>
              <Link to="/collaborators" style={{ fontSize: 16, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Creators</Link>
              <Link to="/profile" style={{ fontSize: 16, fontWeight: 700, color: '#E8981F', textDecoration: 'none' }}>Profile</Link>
            </>
          ) : (
            <>
              <a href="#how" style={{ fontSize: 16, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>How It Works</a>
              <Link to="/collaborators" style={{ fontSize: 16, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Find Creators</Link>
              <Link to="/auth" style={{ fontSize: 16, fontWeight: 700, color: '#E8981F', textDecoration: 'none' }}>Log In</Link>
            </>
          )}
        </div>
      )}

      {/* Hero */}
      <section style={{ paddingTop: 140, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8981F' }}>
            Smart Contract Escrow for Comics
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 72, fontWeight: 400, lineHeight: 1.05,
          letterSpacing: '-0.03em', color: '#1a1816', marginBottom: 28,
        }}>
          Stories need art.<br />Art needs stories.<br />
          <span style={{ fontSize: '0.55em', color: '#6b6560', display: 'block', marginTop: 16 }}>
            Collaborate with confidence.{' '}
            <span style={{ color: '#E8981F', fontStyle: 'italic' }}>Protected on renaissBlock.</span>
          </span>
        </h1>

        <p style={{ fontSize: 18, lineHeight: 1.6, color: '#9e9a95', maxWidth: 520, margin: '0 auto 40px' }}>
          Milestone-based smart contract escrow for indie comics. Artists get paid. Writers get their pages. Every time.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={handleStartProject} className="cta-primary" style={{
            background: '#E8981F', color: '#fff', border: 'none', padding: '16px 28px', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 2px 8px rgba(232,152,31,0.25)', fontFamily: 'var(--font-body)',
          }}>
            Start a Project <ArrowRight />
          </button>
          <button onClick={() => navigate('/collaborators')} style={{
            background: 'transparent', color: '#1a1816', border: '2px solid rgba(58,54,50,0.15)', padding: '14px 28px',
            borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--font-body)',
          }}>
            <PeopleIcon /> Find Creators
          </button>
        </div>

        <div style={{ marginTop: 48 }}>
          <EscrowFlowDiagram />
        </div>
      </section>

      {/* Trust Bar */}
      <section style={{ padding: '48px 24px', borderTop: '1px solid rgba(58,54,50,0.06)', borderBottom: '1px solid rgba(58,54,50,0.06)', background: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', justifyContent: 'space-around', gap: 40 }}>
          <AnimatedStat end={0} suffix="%" label="Funds at risk" />
          <AnimatedStat end={3} suffix="%" label="Escrow fee" />
          <AnimatedStat end={72} suffix="hr" label="Auto-approval" />
        </div>
      </section>

      {/* How It Works */}
      <section id="how" style={{ padding: '80px 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8981F' }}>How It Works</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 42, fontWeight: 400, marginTop: 14, letterSpacing: '-0.02em', color: '#1a1816' }}>
            Four steps to a safe deal
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {howItWorksSteps.map((step, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid rgba(58,54,50,0.06)', borderRadius: 16,
              padding: '28px 24px', display: 'flex', gap: 20, alignItems: 'flex-start',
            }}>
              <div style={{
                minWidth: 44, height: 44, borderRadius: 12, background: 'rgba(232,152,31,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8981F',
              }}>{step.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#c5c0ba', letterSpacing: '0.05em' }}>{step.num}</span>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1816' }}>{step.title}</h3>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: '#6b6560' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The Problem */}
      <section style={{ padding: '80px 24px', background: '#1a1816', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,152,31,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8981F', opacity: 0.8 }}>Peace of Mind</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 38, fontWeight: 400, color: '#FAFAF8', marginTop: 14, marginBottom: 24, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Great collaborations<br />deserve <span style={{ color: '#E8981F', fontStyle: 'italic' }}>real protection</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: 'rgba(250,250,248,0.55)', maxWidth: 560, margin: '0 auto' }}>
            Most indie collaborations go great. But when they don&rsquo;t &mdash; a missed deadline,
            a payment dispute, an unclear split &mdash; there&rsquo;s usually no safety net.
            We&rsquo;re here so you never have to worry about the &ldquo;what if.&rdquo;
          </p>
          <div style={{ marginTop: 40, padding: 24, background: 'rgba(232,152,31,0.06)', borderRadius: 16, border: '1px solid rgba(232,152,31,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldIcon />
              <span style={{ color: '#E8981F', fontWeight: 700, fontSize: 14 }}>How renaissBlock protects you</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(250,250,248,0.65)' }}>
              Funds sit in a smart contract &mdash; not held by us, not held by either party.
              They only move when milestones are approved. If something goes wrong,
              built-in deadlines and auto-approvals ensure nobody gets stuck.
            </p>
          </div>
        </div>
      </section>

      {/* Campaigns Section */}
      <section style={{ padding: '80px 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8981F' }}>Campaigns</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 42, fontWeight: 400, marginTop: 14, letterSpacing: '-0.02em', color: '#1a1816' }}>
            From pitch to funded
          </h2>
          <p style={{ fontSize: 17, color: '#6b6560', marginTop: 10, lineHeight: 1.6, maxWidth: 600, margin: '10px auto 0' }}>
            Create your pitch pages through escrow. Then launch a campaign to fund the full project. Backer money flows directly into production &mdash; never into anyone's personal wallet.
          </p>
        </div>

        {/* Pipeline steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 640, margin: '0 auto 40px' }}>
          {[
            { title: 'Pitch', tag: 'ESCROW', tagColor: '#E8981F', desc: 'Writer hires artist through escrow to create 5 pitch pages. Safe, milestone-based.',
              icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
            { title: 'Campaign', tag: 'FUNDRAISE', tagColor: '#10b981', desc: 'Use those pitch pages to launch a campaign. Backers fund the full issue directly on renaissBlock.',
              icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
            { title: 'Production', tag: 'ESCROW', tagColor: '#E8981F', desc: 'Campaign funds flow into escrow milestones. Full issue gets produced page by page, payment by payment.',
              icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: 'rgba(232,152,31,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8981F', flexShrink: 0,
              }}>{step.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#1a1816' }}>{step.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: `${step.tagColor}15`, color: step.tagColor, letterSpacing: '0.05em',
                  }}>{step.tag}</span>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: '#6b6560', margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mock campaign card */}
        <div style={{
          background: '#fff', border: '1px solid rgba(58,54,50,0.08)', borderRadius: 16,
          padding: 28, maxWidth: 640, margin: '0 auto',
          boxShadow: '0 4px 24px rgba(58,54,50,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>LIVE CAMPAIGN</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: '#1a1816', letterSpacing: '-0.01em' }}>VOID RUNNER &mdash; Issue #1</div>
              <div style={{ fontSize: 13, color: '#9e9a95', marginTop: 2 }}>by J. Chen & M. Torres</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1816', fontFamily: 'var(--font-heading)' }}>$3,240</div>
              <div style={{ fontSize: 12, color: '#9e9a95' }}>of $4,000 goal</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: 'rgba(58,54,50,0.06)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ width: '81%', height: '100%', background: '#E8981F', borderRadius: 4 }} />
          </div>

          {/* Milestone pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Pitch Pages', status: 'done' },
              { label: 'Inks (1-12)', status: 'done' },
              { label: 'Inks (13-24)', status: 'active' },
              { label: 'Colors', status: 'upcoming' },
              { label: 'Letters', status: 'upcoming' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: 'center',
                background: m.status === 'done' ? 'rgba(16,185,129,0.08)' : m.status === 'active' ? 'rgba(232,152,31,0.1)' : 'rgba(58,54,50,0.04)',
                color: m.status === 'done' ? '#059669' : m.status === 'active' ? '#E8981F' : '#9e9a95',
                border: m.status === 'active' ? '1px solid rgba(232,152,31,0.2)' : '1px solid transparent',
              }}>
                {m.status === 'done' && '\u2713 '}{m.label}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#6b6560' }}>
              <strong style={{ color: '#E8981F' }}>47</strong> backers &middot; <strong style={{ color: '#E8981F' }}>18</strong> days left
            </div>
            <button onClick={() => navigate('/campaigns')} style={{
              padding: '10px 20px', background: 'transparent', border: '2px solid #E8981F',
              borderRadius: 10, color: '#E8981F', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}>
              Browse Campaigns
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#9e9a95', marginTop: 20, lineHeight: 1.6 }}>
          Backer funds are held in smart contract escrow &mdash; released only as milestones are completed.<br />
          Stronger protection than any crowdfunding platform.
        </p>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '80px 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8981F' }}>Built for Comics</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 42, fontWeight: 400, marginTop: 14, letterSpacing: '-0.02em', color: '#1a1816' }}>
            Every detail matters
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {features.map((feat, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid rgba(58,54,50,0.06)', borderRadius: 16, padding: '28px 24px',
              transition: 'all 0.3s ease', cursor: 'default',
            }}
            onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#E8981F', marginBottom: 14,
                transition: 'transform 0.3s ease', transform: hoveredCard === i ? 'scale(1.5)' : 'scale(1)',
              }} />
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#1a1816', marginBottom: 10 }}>{feat.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: '#6b6560' }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Creator Directory Preview */}
      <section id="creators" style={{ padding: '64px 24px', background: '#fff', borderTop: '1px solid rgba(58,54,50,0.06)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8981F' }}>Creator Directory</span>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 42, fontWeight: 400, marginTop: 14, letterSpacing: '-0.02em', color: '#1a1816' }}>
              Find your next collaborator
            </h2>
            <p style={{ fontSize: 15, color: '#6b6560', marginTop: 8, lineHeight: 1.6 }}>
              Browse artists, writers, colorists, and letterers. See their work, their rates, and their track record.
            </p>
          </div>

          {/* Real screenshot of collaborator page */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(58,54,50,0.08)', boxShadow: '0 4px 24px rgba(58,54,50,0.06)' }}>
            <img src="/marketplace-preview.png" alt="Creator marketplace" style={{ width: '100%', display: 'block' }} />
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button onClick={() => navigate('/collaborators')} style={{
              background: 'transparent', color: '#1a1816', border: '2px solid rgba(58,54,50,0.15)', padding: '14px 28px',
              borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
              fontFamily: 'var(--font-body)',
            }}>
              <PeopleIcon /> Browse All Creators
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: '#FAFAF8', borderTop: '1px solid rgba(58,54,50,0.06)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <img src="/rb-logo.png" alt="rB" style={{ height: 36 }} />
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 38, fontWeight: 400, marginTop: 20, marginBottom: 16,
            letterSpacing: '-0.02em', color: '#1a1816', lineHeight: 1.15,
          }}>
            Your next deal,<br /><span style={{ color: '#E8981F', fontStyle: 'italic' }}>protected</span>
          </h2>
          <p style={{ fontSize: 17, color: '#6b6560', lineHeight: 1.6, marginBottom: 36 }}>
            Set up your first escrow in under two minutes.<br />Free to start. 3% only when money moves.
          </p>
          <button onClick={handleStartProject} style={{
            background: '#E8981F', color: '#fff', border: 'none', padding: '16px 28px', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
            boxShadow: '0 2px 8px rgba(232,152,31,0.25)', fontFamily: 'var(--font-body)',
          }}>
            Start a Project <ArrowRight />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', borderTop: '1px solid rgba(58,54,50,0.06)', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/rb-logo.png" alt="rB" style={{ height: 20 }} />
            <span style={{ fontSize: 13, color: '#9e9a95' }}>renaissBlock, LLC &copy; 2026</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Link to="/terms" style={{ fontSize: 12, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Terms</Link>
            <Link to="/legal/privacy" style={{ fontSize: 12, fontWeight: 600, color: '#6b6560', textDecoration: 'none' }}>Privacy</Link>
          </div>
        </div>
      </footer>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .nav-links-desktop { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 641px) {
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}
