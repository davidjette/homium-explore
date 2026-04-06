import { Container } from '../../design-system/Layout'
import { H2 } from '../../design-system/Typography'

const THHI_METRICS = [
  { label: 'Average Home Sales Price', value: '$170,625' },
  { label: 'Average Homium SAM %', value: '40%' },
  { label: 'Average AMI', value: '57% ($51,951/yr)' },
  { label: 'Average First Lien Rate', value: '6.21%' },
  { label: 'Average First Lien LTV', value: '53%' },
  { label: 'Average FICO Score', value: '702' },
  { label: 'Average Monthly Income', value: '$4,329' },
  { label: 'Average Front Ratio', value: '15%' },
  { label: 'Average Back Ratio', value: '32%' },
  { label: 'Avg Monthly PITI + Maintenance', value: '$948' },
]

const UDF_METRICS = [
  { label: 'Average Home Sales Price', value: '$433,833' },
  { label: 'Average Homium SAM %', value: '30%' },
  { label: 'Average AMI', value: '87%' },
  { label: 'Average First Lien Rate', value: '6.42%' },
  { label: 'Average First Lien LTV', value: '66%' },
  { label: 'Average FICO Score', value: '743' },
  { label: 'Average Monthly Income', value: '$6,912' },
  { label: 'Average Front Ratio', value: '27%' },
  { label: 'Average Back Ratio', value: '43%' },
  { label: 'Avg Monthly PITI + Maintenance', value: '$2,195' },
]

const STORIES = [
  {
    tag: 'THHI Detroit',
    title: "A Single Mother's Dream Fulfilled",
    text: "A 30-year-old community health worker, navigating the challenges of single parenthood, triumphantly achieved first-time homeownership — securing long-term stability and a brighter future for her family.",
  },
  {
    tag: 'THHI Detroit',
    title: 'A Lifelong Dream Realized',
    text: 'At 65 years young, a dedicated renter at 36% AMI transformed her living situation, finally purchasing the very home she had cherished for 14 years — marking her incredible journey to first-time homeownership.',
  },
  {
    tag: 'Utah Dream Fund',
    title: "A Young Guardian's Milestone",
    text: 'At just 25, a dedicated security guard seized the opportunity for homeownership, unlocking a future of financial independence and planting roots for a prosperous career.',
  },
  {
    tag: 'Utah Dream Fund',
    title: 'Foundation for a Shared Future',
    text: 'A physical therapist and a mechanic, both in their mid-30s, built a strong foundation for their lives together through homeownership — establishing long-term stability and a sense of belonging.',
  },
]

const THHI_STORIES = STORIES.filter(s => s.tag === 'THHI Detroit')
const UDF_STORIES = STORIES.filter(s => s.tag === 'Utah Dream Fund')

export default function BorrowerImpact() {
  return (
    <section className="bg-sectionAlt py-[88px]">
      <Container>
        <div className="mb-12">
          <span className="font-body font-bold text-green text-[11px] uppercase tracking-[2.5px] block mb-3">Borrower Impact</span>
          <H2>Key Impact Loan Data</H2>
        </div>

        {/* Two-column layout: metrics + testimonials per program */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <ProgramColumn title="THHI Program Metrics" metrics={THHI_METRICS} stories={THHI_STORIES} />
          <ProgramColumn title="UDF Program Metrics" metrics={UDF_METRICS} stories={UDF_STORIES} />
        </div>
      </Container>
    </section>
  )
}

function ProgramColumn({ title, metrics, stories }: {
  title: string;
  metrics: Array<{ label: string; value: string }>;
  stories: typeof STORIES;
}) {
  return (
    <div>
      <h3 className="font-heading text-dark text-[22px] mb-1">{title}</h3>
      <div className="border-t-2 border-green mb-2" />
      <div>
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between items-baseline py-2.5 border-b border-border/40">
            <span className="font-body font-light text-gray text-sm">{m.label}</span>
            <span className="font-body font-bold text-dark text-sm">{m.value}</span>
          </div>
        ))}
      </div>

      {/* Testimonials for this program */}
      <div className="mt-8 space-y-4">
        {stories.map((s) => (
          <div key={s.title} className="bg-white border border-border rounded-lg p-6">
            <span className="inline-block bg-greenLight text-green font-body font-bold text-[11px] uppercase tracking-[1.5px] px-3 py-1 rounded-full mb-3">
              {s.tag}
            </span>
            <h4 className="font-heading text-dark text-[19px] mb-2">{s.title}</h4>
            <p className="font-body font-light text-gray text-sm leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
