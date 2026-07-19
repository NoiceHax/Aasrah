"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { resolveImageUrl } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import type { NgoUpdateInput } from "@/lib/api/types";

export default function ProfilePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<NgoUpdateInput>({});

  const { data: ngo, isLoading } = useQuery({
    queryKey: ["ngo", "profile"],
    queryFn: ngoApi.profile,
  });

  // Hydrate the editable form once the NGO profile query resolves.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (ngo) {
      setForm({
        name: ngo.name,
        focus_area: ngo.focus_area ?? "",
        location: ngo.location ?? "",
        description: ngo.description ?? "",
        website: ngo.website ?? "",
        contact_email: ngo.contact_email ?? "",
        contact_phone: ngo.contact_phone ?? "",
        operating_hours: ngo.operating_hours ?? "",
        emergency_contact: ngo.emergency_contact ?? "",
        shelter_locations: ngo.shelter_locations ?? "",
        service_latitude: ngo.service_latitude ?? undefined,
        service_longitude: ngo.service_longitude ?? undefined,
        service_radius_km: ngo.service_radius_km,
      });
    }
  }, [ngo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveMutation = useMutation({
    mutationFn: () => ngoApi.updateProfile(form),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["ngo", "profile"] });
    },
    onError: (e) => toast.error("Couldn't save", normalizeError(e).message),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => ngoApi.uploadLogo(file),
    onSuccess: () => {
      toast.success("Logo updated");
      qc.invalidateQueries({ queryKey: ["ngo", "profile"] });
    },
    onError: (e) => toast.error("Upload failed", normalizeError(e).message),
  });

  const set = (k: keyof NgoUpdateInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setNum = (k: keyof NgoUpdateInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value === "" ? undefined : Number(e.target.value) }));

  if (isLoading || !ngo) {
    return (
      <>
        <PortalPageHeader title="Organization Profile" />
        <div className="p-margin-mobile md:p-margin-desktop">
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PortalPageHeader
        title="Organization Profile"
        action={
          <Button leadingIcon="save" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        }
      />

      <div className="grid gap-gutter p-margin-mobile md:p-margin-desktop lg:grid-cols-3">
        {/* Logo + verification */}
        <Card className="flex flex-col items-center gap-4 p-stack-lg text-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high">
            {ngo.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(ngo.logo_url)} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Icon name="corporate_fare" className="text-[40px] text-on-surface-variant" />
            )}
          </div>
          <div>
            <p className="text-headline-sm text-primary">{ngo.name}</p>
            {ngo.is_verified ? (
              <Badge variant="info">
                <Icon name="verified" className="mr-1 text-[14px]" filled /> Verified
              </Badge>
            ) : (
              <Badge variant="warning">Pending verification</Badge>
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) logoMutation.mutate(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" leadingIcon="upload" onClick={() => logoRef.current?.click()}>
            Change Logo
          </Button>
        </Card>

        {/* Details */}
        <Card className="flex flex-col gap-4 p-stack-md lg:col-span-2">
          <h2 className="text-headline-sm text-primary">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Organization name" value={form.name ?? ""} onChange={set("name")} />
            <Input label="Focus area" value={form.focus_area ?? ""} onChange={set("focus_area")} />
            <Input label="Location" value={form.location ?? ""} onChange={set("location")} />
            <Input label="Website" value={form.website ?? ""} onChange={set("website")} />
            <Input label="Contact email" type="email" value={form.contact_email ?? ""} onChange={set("contact_email")} />
            <Input label="Contact phone" value={form.contact_phone ?? ""} onChange={set("contact_phone")} />
            <Input label="Operating hours" value={form.operating_hours ?? ""} onChange={set("operating_hours")} />
            <Input label="Emergency contact" value={form.emergency_contact ?? ""} onChange={set("emergency_contact")} />
          </div>
          <Textarea label="Description" rows={3} value={form.description ?? ""} onChange={set("description")} />
          <Textarea label="Shelter locations" rows={2} value={form.shelter_locations ?? ""} onChange={set("shelter_locations")} />

          <h3 className="mt-2 text-label-md font-semibold text-primary">Service Area</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Latitude" type="number" value={form.service_latitude ?? ""} onChange={setNum("service_latitude")} />
            <Input label="Longitude" type="number" value={form.service_longitude ?? ""} onChange={setNum("service_longitude")} />
            <Input label="Radius (km)" type="number" value={form.service_radius_km ?? ""} onChange={setNum("service_radius_km")} />
          </div>
        </Card>
      </div>
    </>
  );
}
