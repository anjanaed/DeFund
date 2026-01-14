import Button from '../common/Button'

export default function CTASection() {
  return (
    <section id="start" className="cta-section">
      <div className="container">
        <div className="cta-box">
          <div className="cta-badge">
            Ready to launch?
          </div>
          <h2 className="cta-title">Join the Future of Web3 Funding</h2>
          <p className="cta-description">
            Be part of a community that's revolutionizing how decentralized projects get 
            funded. Start a project or become a contributor today.
          </p>
          <div className="cta-buttons">
            <Button variant="primary">
              Start Your Project →
            </Button>
            <Button variant="secondary">
              Explore Projects
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
