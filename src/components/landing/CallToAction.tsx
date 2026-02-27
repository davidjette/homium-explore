import { Link } from 'react-router-dom'
import { Container } from '../../design-system/Layout'
import { H2, Body } from '../../design-system/Typography'
import { Button } from '../../design-system/Button'

export default function CallToAction() {
  return (
    <section className="bg-dark py-[88px]">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <H2 className="text-white">Ready to Explore Your Market?</H2>
          <Body className="mt-4 text-white/70 text-lg">
            See the affordability gap in your state, design a custom shared appreciation program,
            and model 30-year fund projections — all in minutes.
          </Body>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link to="/explore">
              <Button size="lg">
                Launch Affordability Tool
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Button>
            </Link>
            <a href="https://calendly.com/homium" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                Schedule a Conversation
              </Button>
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
