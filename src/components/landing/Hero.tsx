import { Container } from '../../design-system/Layout'
import { Body } from '../../design-system/Typography'
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
        <div className="max-w-3xl mx-auto text-center">
          <span className="font-body font-bold text-green text-[11px] uppercase tracking-[2.5px] mb-4 block">
            Shared Appreciation Down Payment Assistance
          </span>
          <h1 className="font-heading font-normal text-dark text-[50px] leading-[1.12] max-md:text-[32px]">
            The End-to-End Down Payment<br className="max-md:hidden" /> Assistance Program Solution for<br className="max-md:hidden" /> Affordable Homeownership
          </h1>
          <Body className="mt-6 text-lg max-w-2xl mx-auto text-gray">
            A showcase of the transformative impact Homium creates through its programs like the
            Tobias Harris Homeownership Initiative and Utah Dream Fund, and how you can design
            a program to create a pathway to homeownership for working families in your community.
          </Body>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <a href="#affordability">
              <Button size="lg">
                Explore Your Market
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
              </Button>
            </a>
            <a href="#programs">
              <Button variant="outline" size="lg">Explore Programs</Button>
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
