import { Container } from '../../design-system/Layout'
import { H2, Body, Label } from '../../design-system/Typography'

export default function VideoEmbed() {
  return (
    <section className="py-[88px]">
      <Container>
        <div className="text-center mb-10">
          <Label className="text-green block mb-3">Watch</Label>
          <H2>See Homium in Action</H2>
          <Body className="mt-4 max-w-2xl mx-auto">
            Learn how Homium continues to transform lives through innovative financing solutions
            that make homeownership accessible to working families.
          </Body>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-lg"
              src="https://www.youtube.com/embed/XZCdLg3x2T0"
              title="See Homium in Action"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
