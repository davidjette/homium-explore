import { Link } from 'react-router-dom'
import { Container } from '../../design-system/Layout'
import { H2, Body, Label } from '../../design-system/Typography'

const BASE = import.meta.env.BASE_URL

export default function CheckAddressIndex() {
  return (
    <div className="py-12">
      <Container>
        <div className="text-center mb-12">
          <Label className="text-green block mb-3">Program Eligibility</Label>
          <H2>Check Address Tools</H2>
          <Body className="mt-4 max-w-2xl mx-auto">
            Verify whether an address falls within a Homium program's qualifying zones.
          </Body>
        </div>

        <div className="max-w-lg mx-auto">
          <Link
            to="/check-address/udf"
            className="block relative rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end p-8 group"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${BASE}assets/images/utahlandscape.png')` }}
            />
            <div className="absolute inset-0 bg-white/75 group-hover:bg-white/65 transition-colors" />
            <div className="relative z-10 text-dark">
              <Label className="text-gray mb-2 block">Utah</Label>
              <h3 className="font-heading text-[26px] max-md:text-[22px] leading-tight mb-3">
                Utah Dream Fund
              </h3>
              <p className="font-body font-light text-dark/80 text-sm leading-relaxed mb-5 max-w-md">
                Fair, innovative financing helps Utah families build wealth and strengthen
                communities. The Utah Dream Fund bridges the affordability gap and enables early
                access to homeownership through Promise Partnership Utah.
              </p>
              <span className="inline-flex items-center gap-2 bg-green text-white font-body font-bold text-[12px] uppercase tracking-[1.5px] px-5 py-2.5 rounded-md group-hover:bg-greenDark transition-colors">
                Check Address
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </Link>
        </div>
      </Container>
    </div>
  )
}
