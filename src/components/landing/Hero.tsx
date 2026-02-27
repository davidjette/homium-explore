import { Link } from 'react-router-dom'
import { Container } from '../../design-system/Layout'
import { Body, Label } from '../../design-system/Typography'
import { Button } from '../../design-system/Button'

const BASE = import.meta.env.BASE_URL

export default function Hero() {
  return (
    <section
      className="relative bg-dark text-white py-[120px] max-md:py-[80px] overflow-hidden"
    >
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${BASE}assets/images/homiumbackground.jpg')` }}
      />
      <div className="absolute inset-0 bg-white/[0.72]" />

      <Container className="relative z-10">
        <div className="max-w-3xl">
          <Label className="text-green mb-4 block">
            Shared Appreciation Down Payment Assistance
          </Label>
          <h1 className="font-heading font-normal text-dark text-[50px] leading-[1.12] max-md:text-[32px]">
            Close the Affordability Gap<br className="max-md:hidden" /> in Your Community
          </h1>
          <Body className="mt-6 text-lg max-w-2xl text-gray">
            Homium partners with HFAs, governments, municipalities, universities, and nonprofits
            to build shared appreciation homeownership programs that create sustainable pathways
            to homeownership for working families.
          </Body>
          <div className="flex flex-wrap items-center gap-4 mt-10">
            <Link to="/explore">
              <Button size="lg">
                Explore Your Market
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Button>
            </Link>
            <a href="#programs">
              <Button variant="outline" size="lg">Explore Programs</Button>
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
