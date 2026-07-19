import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/layout/page-header";
import { TrackLookup } from "@/components/track/track-lookup";

export const metadata: Metadata = {
  title: "Track a Report",
  description:
    "Track the live status of a humanitarian report using its reference ID: from received and verified through to claimed and resolved.",
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="Track a report"
        description="Enter the reference ID issued when you submitted a report to follow its progress in real time."
      />
      <Container size="content" className="py-16">
        <div className="mx-auto max-w-2xl">
          <TrackLookup initialId={id} />
        </div>
      </Container>
    </>
  );
}
