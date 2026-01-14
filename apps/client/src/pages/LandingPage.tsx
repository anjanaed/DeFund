import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Hero from '../components/sections/Hero'
import Features from '../components/sections/Features'
import HowItWorks from '../components/sections/HowItWorks'
import CTASection from '../components/sections/CTASection'

export default function LandingPage() {
  return (
    <div className="app">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <CTASection />
      <Footer />
    </div>
  )
}
