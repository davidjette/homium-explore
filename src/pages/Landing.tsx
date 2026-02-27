import Hero from '../components/landing/Hero'
import VideoEmbed from '../components/landing/VideoEmbed'
import AffordabilityTool from '../components/landing/AffordabilityTool'
import ProgramCards from '../components/landing/ProgramCards'
import BorrowerImpact from '../components/landing/BorrowerImpact'
import NewsGrid from '../components/landing/NewsGrid'
import CallToAction from '../components/landing/CallToAction'

export default function Landing() {
  return (
    <>
      <Hero />
      <VideoEmbed />
      <AffordabilityTool />
      <ProgramCards />
      <BorrowerImpact />
      <NewsGrid />
      <CallToAction />
    </>
  )
}
