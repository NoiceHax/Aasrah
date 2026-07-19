import { Hero } from "@/components/home/hero";
import { StatsBand } from "@/components/home/stats-band";
import { HowItWorks } from "@/components/home/how-it-works";
import { NgoShowcase } from "@/components/home/ngo-showcase";
import { CallToAction } from "@/components/home/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBand />
      <HowItWorks />
      <NgoShowcase />
      <CallToAction />
    </>
  );
}
