import FeatureCard from '../common/FeatureCard'
import { HiShieldCheck } from 'react-icons/hi'
import { HiUsers } from 'react-icons/hi'
import { HiCheckBadge } from 'react-icons/hi2'
import { HiChartBar } from 'react-icons/hi'
import { HiShieldExclamation } from 'react-icons/hi'
import { HiBolt } from 'react-icons/hi2'

export default function Features() {
  const features = [
    {
      icon: HiShieldCheck,
      title: 'Smart Contract Security',
      description: 'Funds locked in transparent smart contracts release only when milestones are met'
    },
    {
      icon: HiUsers,
      title: 'Community Voting',
      description: 'Contributors vote to approve milestones, ensuring every project remains accountable'
    },
    {
      icon: HiCheckBadge,
      title: 'Verified Projects',
      description: 'Admin-verified creators with transparent roadmaps and verified public repositories'
    },
    {
      icon: HiChartBar,
      title: 'Milestone Tracking',
      description: 'Real-time progress tracking with verifiable proof of project execution'
    },
    {
      icon: HiShieldExclamation,
      title: 'Fraud Protection',
      description: 'Unspent contributions returned if milestones fail or projects abandon'
    },
    {
      icon: HiBolt,
      title: 'Instant Reclaim',
      description: 'Withdraw contributions anytime if milestones are rejected by community'
    }
  ]

  return (
    <section id="features" className="features">
      <div className="container">
        <h2 className="section-title">Built for Trust & Transparency</h2>
        <p className="section-description">
          DeFund combines blockchain security with community governance to create the 
          safest crowdfunding ecosystem
        </p>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
