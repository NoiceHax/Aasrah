import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/routes";

const highlights = [
  { icon: "verified_user", label: "Verified NGOs" },
  { icon: "bolt", label: "Real-time coordination" },
  { icon: "visibility", label: "Auditable end to end" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / context panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-on-primary lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <Link href={routes.home} className="relative flex items-center gap-2">
          <Image src="/logo.png" alt={siteConfig.name} width={40} height={40} className="h-10 w-10 rounded-md object-contain" />
          <span className="text-headline-sm font-extrabold tracking-tight">{siteConfig.name}</span>
        </Link>

        <div className="relative flex flex-col gap-6">
          <h2 className="max-w-md text-headline-lg">
            The operational backbone for humanitarian response.
          </h2>
          <p className="max-w-md text-body-md text-on-primary-container opacity-90">
            Coordinate reports, claim cases, and dispatch volunteers, all on one transparent,
            enterprise-grade platform.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            {highlights.map((h) => (
              <div key={h.label} className="flex items-center gap-3">
                <Icon name={h.icon} className="text-[22px]" filled />
                <p className="text-body-md text-on-primary-container opacity-90">{h.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-label-sm text-on-primary-container opacity-70">
          © {new Date().getFullYear()} {siteConfig.name} Humanitarian Systems
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Link href={routes.home} className="flex items-center gap-2">
            <Image src="/logo.png" alt={siteConfig.name} width={40} height={40} className="h-10 w-10 object-contain" />
            <span className="text-headline-sm font-extrabold tracking-tight text-primary">
              {siteConfig.name}
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
