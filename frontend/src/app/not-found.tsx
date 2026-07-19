import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-fixed-variant">
        <Icon name="explore_off" className="text-[32px]" />
      </div>
      <p className="text-headline-lg font-bold text-secondary">404</p>
      <h1 className="mt-2 text-headline-md text-primary">Page not found</h1>
      <p className="mt-3 max-w-md text-body-md text-on-surface-variant">
        The page you&apos;re looking for doesn&apos;t exist or may have moved. Let&apos;s get you
        back on track.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href={routes.home} leadingIcon="home">
          Back to home
        </Button>
        <Button href={routes.report} variant="outline" leadingIcon="report">
          Report a Person
        </Button>
      </div>
      <Link
        href={routes.contact}
        className="mt-6 text-label-md font-medium text-secondary hover:underline"
      >
        Contact support
      </Link>
    </div>
  );
}
