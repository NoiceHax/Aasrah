import Link from "next/link";
import Image from "next/image";
import { footerNav, routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer className="border-t border-outline-variant bg-surface-container-lowest">
      <Container size="wide" className="py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="flex max-w-xs flex-col gap-4 md:col-span-4">
            <Link href={routes.home} className="flex items-center gap-2">
              <Image src="/logo.png" alt={siteConfig.name} width={40} height={40} className="h-10 w-10 object-contain" />
              <span className="text-headline-sm font-extrabold tracking-tight text-primary">
                {siteConfig.name}
              </span>
            </Link>
            <p className="text-body-sm text-on-surface-variant">
              Building the digital infrastructure for humanitarian response and community-led
              care.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-3">
            {footerNav.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <span className="text-label-sm uppercase tracking-wider text-primary">
                  {group.title}
                </span>
                {group.links.map((link) => (
                  <Link
                    key={`${group.title}-${link.label}`}
                    href={link.href}
                    className="text-body-sm text-on-surface-variant transition-colors hover:text-secondary"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-outline-variant pt-8 md:flex-row">
          <p className="text-label-sm text-on-surface-variant">
            © {new Date().getFullYear()} {siteConfig.name} Humanitarian Systems. All rights
            reserved.
          </p>
          <div className="flex gap-stack-md">
            <Link
              href="/privacy"
              className="text-label-sm text-on-surface-variant hover:text-secondary"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-label-sm text-on-surface-variant hover:text-secondary"
            >
              Terms of Service
            </Link>
            <Link
              href={routes.contact}
              className="text-label-sm text-on-surface-variant hover:text-secondary"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
