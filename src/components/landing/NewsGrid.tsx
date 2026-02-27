import { Container } from '../../design-system/Layout'
import { H2, Body, Label } from '../../design-system/Typography'

const NEWS = [
  {
    title: 'Down Payment Challenge in Metro Detroit',
    description: 'Axios reports it takes ~8 years to save for a down payment in Metro Detroit, highlighting how down payment barriers constrain homeownership.',
    url: 'https://www.axios.com/local/detroit/2026/02/04/down-payment-metro-detroit-house-home-mortgage',
    cta: 'Read Article',
  },
  {
    title: 'Housing Inventory Challenges',
    description: "WSJ reports on home builders turning to the White House for help addressing inventory constraints, underscoring the broader housing supply challenges DPA programs help address.",
    url: 'https://www.wsj.com/economy/housing/home-builders-turn-to-white-house-for-help-on-inventory-glut-7e41e708',
    cta: 'Read Article',
  },
  {
    title: 'Innovative DPA Models',
    description: "Investopedia highlights a Midwestern city and NBA star partnership covering 40% of homebuyers' down payments, showcasing community-driven approaches to DPA.",
    url: 'https://www.investopedia.com/this-midwestern-city-and-an-nba-star-will-cover-40-of-homebuyers-down-payments-11815298',
    cta: 'Read Article',
  },
  {
    title: 'Rep. Andy Barr on Fair Share Appreciation Mortgages',
    description: "Congressional support for innovative mortgage solutions that expand homeownership access, highlighting bipartisan recognition of DPA programs' impact.",
    url: 'https://www.linkedin.com/posts/homium_rep-andy-barr-fair-share-appreciation-mortgages-activity-7402075947799412736-IN3g',
    cta: 'Read Post',
  },
  {
    title: 'Congressional Hearing on Housing & Urban Development',
    description: "C-SPAN coverage of House Committee hearing featuring Rep. Andy Barr's remarks on innovative mortgage solutions, demonstrating legislative support for DPA programs.",
    url: 'https://www.c-span.org/clip/house-committee/user-clip-rep-jim-himes-and-rep-andy-barr-on-solutions-for-affordable-homeownership/5192601',
    cta: 'Watch Clip',
  },
  {
    title: 'CFPB Issue Spotlight: Home Equity Contracts',
    description: "CFPB market overview references Homium as an example of companies offering shared equity programs that are 1:1 sales of the home's value. (Endnote 23)",
    url: 'https://www.consumerfinance.gov/data-research/research-reports/issue-spotlight-home-equity-contracts-market-overview/',
    cta: 'Read Report',
  },
]

export default function NewsGrid() {
  return (
    <section className="py-[88px]">
      <Container>
        <div className="mb-10">
          <Label className="text-green block mb-3">In the News</Label>
          <H2>Relevant News</H2>
          <Body className="mt-4 max-w-2xl">
            Coverage of the housing affordability crisis and the growing recognition of shared
            appreciation mortgage programs as a solution.
          </Body>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {NEWS.map((n) => (
            <div key={n.title} className="bg-white border border-border rounded-lg p-6 flex flex-col">
              <h4 className="font-heading text-dark text-[19px] mb-3">{n.title}</h4>
              <p className="font-body font-light text-gray text-sm leading-relaxed flex-1 mb-4">
                {n.description}
              </p>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-body font-bold text-green text-[12px] uppercase tracking-[1.5px] hover:text-greenDark transition-colors"
              >
                {n.cta}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
