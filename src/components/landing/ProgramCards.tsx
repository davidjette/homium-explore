import { Container } from '../../design-system/Layout'
import { H2, Body, Label } from '../../design-system/Typography'

const BASE = import.meta.env.BASE_URL

const PROGRAMS = [
  {
    location: 'Detroit, Michigan',
    name: 'Tobias Harris Homeownership Initiative',
    description: 'Tobias Harris partners with Homium to bring a new path to homeownership to Detroit — no monthly payments, just a fair, sustainable way for families to build equity and stay rooted in their communities.',
    image: `${BASE}assets/images/pexels-bernardino-munoz-3767003-5796988.jpg`,
    url: 'https://www.thhidetroit.com/',
  },
  {
    location: 'Utah',
    name: 'Utah Dream Fund',
    description: 'Fair, innovative financing helps Utah families build wealth and strengthen communities. The Utah Dream Fund bridges the affordability gap and enables early access to homeownership through Promise Partnership Utah.',
    image: `${BASE}assets/images/utahlandscape.png`,
    url: 'https://www.utahdreamfund.com/',
  },
]

export default function ProgramCards() {
  return (
    <section id="programs" className="py-[88px]">
      <Container>
        <div className="text-center mb-12">
          <Label className="text-green block mb-3">Launched Programs</Label>
          <H2>Program Borrower Impact Overview</H2>
          <Body className="mt-4 max-w-2xl mx-auto">
            Homium partners with state and local HFAs, municipalities, and nonprofits to offer
            shared appreciation mortgage down payment support built for homeowners to succeed.
          </Body>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROGRAMS.map((p) => (
            <div
              key={p.name}
              className="relative rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end p-8"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${p.image}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/50 to-transparent" />
              <div className="relative z-10 text-white">
                <Label className="text-green/80 mb-2 block">{p.location}</Label>
                <h3 className="font-heading text-[26px] max-md:text-[22px] leading-tight mb-3">{p.name}</h3>
                <p className="font-body font-light text-white/80 text-sm leading-relaxed mb-5 max-w-md">
                  {p.description}
                </p>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green text-white font-body font-bold text-[12px] uppercase tracking-[1.5px] px-5 py-2.5 rounded-md hover:bg-greenDark transition-colors"
                >
                  Visit
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M7 17L17 7M17 7H7M17 7v10"/>
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
