import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { routes } from "@/lib/routes";

export function CallToAction() {
  return (
    <Section surface="primary" className="text-center">
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6">
        <h2 className="text-headline-lg md:text-display-lg">Ready to make a difference?</h2>
        <p className="text-body-lg text-on-primary-container opacity-90">
          Join hundreds of NGOs and thousands of volunteers in our mission to ensure no call for
          help goes unanswered.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href={routes.register} variant="secondary" size="lg">
            Get Started Today
          </Button>
          <Button
            href={routes.volunteer}
            size="lg"
            className="border border-white/20 text-on-primary hover:bg-white/10"
          >
            Become a Volunteer
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
