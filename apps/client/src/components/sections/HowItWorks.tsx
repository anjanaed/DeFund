import StepCard from '../common/StepCard'

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Project Verification',
      description: 'Creators submit open-source projects with defined milestones. Admins verify authenticity through wallet signing and repository validation.'
    },
    {
      number: '02',
      title: 'Contribution Phase',
      description: 'Contributors fund projects on-chain. Funds are locked in smart contracts until milestones are approved'
    },
    {
      number: '03',
      title: 'Community Voting',
      description: 'Project creators submit evidence of milestone completion. Contributors vote to approve fund release'
    },
    {
      number: '04',
      title: 'Fund Release',
      description: 'Once approved by community voting, funds automatically release to project creators via smart contracts'
    }
  ]

  return (
    <section id="how-it-works" className="how-it-works">
      <div className="container">
        <h2 className="section-title">How DeFund Works</h2>
        <p className="section-description">
          A transparent four-step process ensuring accountability at every stage
        </p>
        
        <div className="steps">
          {steps.map((step, index) => (
            <StepCard
              key={index}
              number={step.number}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
