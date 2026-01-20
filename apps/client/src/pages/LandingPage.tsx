import { Link } from 'react-router-dom'
import { HiShieldCheck, HiUserGroup, HiDocumentCheck, HiChartBar, HiLockClosed, HiBolt, HiArrowRight } from 'react-icons/hi2'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import logo from '../assets/logo.png'

export default function LandingPage() {
  const stats = [
    { label: 'Total Raised', value: '$24M+' },
    { label: 'Projects', value: '1200+' },
    { label: 'Contributors', value: '45K+' },
    { label: 'Success Rate', value: '98%' }
  ]

  const features = [
    {
      icon: HiShieldCheck,
      title: 'Smart Contract Security',
      description: 'Funds locked in transparent smart contracts, released only when milestones are met.'
    },
    {
      icon: HiUserGroup,
      title: 'Community Voting',
      description: 'Contributors vote to approve milestones, ensuring every project remains accountable.'
    },
    {
      icon: HiDocumentCheck,
      title: 'Verified Projects',
      description: 'Admins verified creators with transparent identities and verified GitHub repositories.'
    },
    {
      icon: HiChartBar,
      title: 'Milestone Tracking',
      description: 'Real-time progress tracking with verifiable proof of project execution.'
    },
    {
      icon: HiLockClosed,
      title: 'Fraud Protection',
      description: 'Unspent contributions returned if milestones fail or projects abandon.'
    },
    {
      icon: HiBolt,
      title: 'Instant Reclaim',
      description: 'Withdraw contributions anytime if milestones are rejected by community.'
    }
  ]

  const steps = [
    {
      id: '01',
      title: 'Project Verification',
      description: 'Creators submit projects with defined milestones. Admins verify authenticity through wallet signing and GitHub validation.'
    },
    {
      id: '02',
      title: 'Contribution Phase',
      description: 'Contributors fund projects on-chain. Funds are locked in smart contracts until milestones are approved.'
    },
    {
      id: '03',
      title: 'Community Voting',
      description: 'Project creators submit evidence of milestone completion. Contributors vote to approve fund release.'
    },
    {
      id: '04',
      title: 'Fund Release',
      description: 'Once approved by community voting, funds automatically release to project creators via smart contracts.'
    }
  ]

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden' }}>
      <Navbar />
      
      {/* Hero Section */}
      <section id="start" style={{ 
        padding: '100px 24px 80px', 
        textAlign: 'center', 
        maxWidth: '1200px', 
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%'
      }}>
        {/* Logo */}
        <div className="hero-logo">
           <img src={logo} alt="DeFund Logo" className="hero-logo-anim" />
        </div>

        <h1 style={{ 
          fontSize: '72px', 
          fontWeight: '800', 
          color: '#8B5CF6',
          marginBottom: '16px',
          lineHeight: '1',
          letterSpacing: '-2px'
        }}>
          DeFund
        </h1>
        <h2 style={{ 
          fontSize: '48px', 
          fontWeight: '800', 
          color: '#111827',
          marginBottom: '24px',
          lineHeight: '1.2'
        }}>
          Fund Innovation<br />Without Risk
        </h2>
        
        <p style={{ 
          fontSize: '18px', 
          color: '#4B5563', 
          maxWidth: '600px', 
          marginBottom: '40px',
          lineHeight: '1.6'
        }}>
          DeFund combines blockchain security with community governance to create the safest crowdfunding ecosystem.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '64px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link 
            to="/home" 
            className="btn-landing-primary"
          >
            Start Your Project <HiArrowRight style={{ marginLeft: '8px' }} />
          </Link>
          <Link 
            to="/explore" 
            className="btn-landing-secondary"
          >
            Explore Projects
          </Link>
        </div>

        {/* Stats Row */}
        <div style={{ 
          display: 'flex', 
          gap: '32px',
          background: '#F9F8FF',
          padding: '24px 48px',
          borderRadius: '24px',
          border: '1px solid #E9D5FF',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {stats.map((stat, idx) => (
            <div key={idx} style={{ textAlign: 'center', padding: '0 16px' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#8B5CF6' }}>{stat.value}</div>
              <div style={{ fontSize: '13px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ padding: '80px 24px', background: '#FFFFFF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '16px', color: '#111827' }}>Built for Trust & Transparency</h2>
          <p style={{ color: '#4B5563', maxWidth: '700px', margin: '0 auto 64px', fontSize: '16px' }}>
            DeFund combines blockchain security with community governance to create the safest crowdfunding ecosystem.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', textAlign: 'left' }}>
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div key={idx} style={{ 
                  padding: '32px', 
                  borderRadius: '24px', 
                  border: '1px solid #E5E7EB',
                  background: 'white',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  transition: 'transform 0.2s',
                  cursor: 'default'
                }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: '#8B5CF6', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginBottom: '24px',
                    color: 'white'
                  }}>
                    <Icon size={24} />
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', color: '#111827' }}>{feature.title}</h3>
                  <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: '1.6' }}>{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How DeFund Works Section */}
      <section id="how-it-works" style={{ padding: '100px 24px', background: '#FDFBFF' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '16px', color: '#111827' }}>How DeFund Works</h2>
            <p style={{ color: '#4B5563', fontSize: '16px' }}>A transparent four-step process ensuring accountability at every stage</p>
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '64px' }}>
            {/* Vertical Line */}
            <div style={{ 
              position: 'absolute', 
              left: '48px', 
              top: '0', 
              bottom: '0', 
              width: '2px', 
              background: '#E5E7EB',
              zIndex: 0
            }} />

            {steps.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '48px', position: 'relative', zIndex: 1 }}>
                <div style={{ 
                  width: '96px', 
                  height: '96px', 
                  background: '#8B5CF6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: '700',
                  flexShrink: 0,
                  boxShadow: '0 0 0 8px #F3E8FF'
                }}>
                  {step.id}
                </div>
                <div style={{ paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#8B5CF6' }}>{step.title}</h3>
                  <p style={{ fontSize: '16px', color: '#4B5563', maxWidth: '600px', lineHeight: '1.6' }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="community" style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          background: 'linear-gradient(135deg, #E0C8FF 0%, #D8B4FE 100%)',
          borderRadius: '32px',
          padding: '80px 24px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '8px 24px', 
            borderRadius: '99px', 
            display: 'inline-block', 
            color: '#8B5CF6',
            fontWeight: '600',
            fontSize: '14px',
            marginBottom: '32px'
          }}>
            Ready to launch?
          </div>
          
          <h2 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '24px', color: '#2E1065' }}>
            Join the Future of Web3 Funding
          </h2>
          <p style={{ fontSize: '18px', color: '#5B21B6', maxWidth: '600px', margin: '0 auto 48px', lineHeight: '1.6' }}>
            Be part of a community that's revolutionizing how decentralized projects get funded. Start a project or become a contributor today.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
             <Link 
              to="/home" 
              className="btn-landing-primary"
            >
              Start Your Project <HiArrowRight style={{ marginLeft: '8px' }} />
            </Link>
            <Link 
              to="/explore" 
              className="btn-landing-secondary"
              style={{ background: 'rgba(255,255,255,0.8)', border: 'none' }}
            >
              Explore Projects
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
