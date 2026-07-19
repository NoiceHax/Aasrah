import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Route-level loading state for public pages. */
export default function PublicLoading() {
  return (
    <>
      <div className="bg-primary py-16 md:py-20">
        <Container className="flex flex-col gap-4">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-12 w-3/4 max-w-xl bg-white/10" />
          <Skeleton className="h-5 w-full max-w-2xl bg-white/10" />
        </Container>
      </div>
      <Container className="py-16">
        <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-md"
            >
              <Skeleton className="h-11 w-11 rounded-lg" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
