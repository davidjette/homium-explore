import Hero from '../components/landing/Hero'
import ProgramCards from '../components/landing/ProgramCards'
import BorrowerImpact from '../components/landing/BorrowerImpact'
import VideoEmbed from '../components/landing/VideoEmbed'
import NewsGrid from '../components/landing/NewsGrid'
import CallToAction from '../components/landing/CallToAction'

export default function Landing() {
  return (
    <>
      <Hero />
      <ProgramCards />
      <BorrowerImpact />
      <VideoEmbed />
      <NewsGrid />
      <CallToAction />
    </>
  )
}
