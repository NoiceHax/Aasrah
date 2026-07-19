"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/notifications/toast";
import { Select } from "@/components/ui/select";
import { volunteerApi } from "@/lib/api/volunteer";
import { resolveImageUrl, statsApi } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import type { VolunteerAssignmentMode, VolunteerProfileUpdate } from "@/lib/api/types";

export default function VolunteerProfilePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<VolunteerProfileUpdate>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ["volunteer", "profile"],
    queryFn: volunteerApi.profile,
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (profile) {
      setForm({
        phone: profile.phone ?? "",
        role_title: profile.role_title ?? "",
        availability: profile.availability ?? "",
        emergency_contact: profile.emergency_contact ?? "",
        working_radius_km: profile.working_radius_km ?? undefined,
        schedule: profile.schedule ?? "",
        skills: profile.skills,
        certifications: profile.certifications,
        languages: profile.languages,
      });
    }
  }, [profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () => volunteerApi.updateProfile(form),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["volunteer", "profile"] });
    },
    onError: (e) => toast.error("Couldn't save", normalizeError(e).message),
  });

  const avatar = useMutation({
    mutationFn: (file: File) => volunteerApi.uploadAvatar(file),
    onSuccess: () => {
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["volunteer", "profile"] });
    },
    onError: (e) => toast.error("Upload failed", normalizeError(e).message),
  });

  // Assignment-mode: Independent vs affiliated with a preferred NGO.
  const { data: ngos } = useQuery({ queryKey: ["public", "ngos"], queryFn: statsApi.ngos });
  const [selectedNgo, setSelectedNgo] = useState<string>("");
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (profile?.ngo_id) setSelectedNgo(profile.ngo_id);
  }, [profile?.ngo_id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mode = useMutation({
    mutationFn: (input: { mode: VolunteerAssignmentMode; ngoId?: string | null }) =>
      volunteerApi.setAssignmentMode(input.mode, input.ngoId),
    onSuccess: () => {
      toast.success("Assignment preference updated");
      qc.invalidateQueries({ queryKey: ["volunteer", "profile"] });
    },
    onError: (e) => toast.error("Couldn't update preference", normalizeError(e).message),
  });

  const setStr = (k: keyof VolunteerProfileUpdate) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCsv = (k: "skills" | "certifications" | "languages") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }));

  if (isLoading || !profile) {
    return (
      <>
        <ShellPageHeader title="Profile" />
        <div className="p-margin-mobile md:p-margin-desktop"><Skeleton className="h-96 w-full" /></div>
      </>
    );
  }

  return (
    <>
      <ShellPageHeader
        title="My Profile"
        action={
          <Button leadingIcon="save" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        }
      />
      <div className="grid gap-gutter p-margin-mobile md:p-margin-desktop lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-4 p-stack-lg text-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-surface-container-high">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(profile.avatar_url)} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <Icon name="person" className="text-[40px] text-on-surface-variant" />
            )}
          </div>
          <div>
            <p className="text-headline-sm text-primary">{profile.name}</p>
            <p className="text-label-sm text-on-surface-variant">{profile.email}</p>
          </div>
          <input
            ref={avatarRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) avatar.mutate(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" leadingIcon="upload" onClick={() => avatarRef.current?.click()}>
            Change Photo
          </Button>
          <div className="flex w-full justify-around border-t border-outline-variant pt-3 text-center">
            <div>
              <p className="text-headline-sm font-bold text-primary">{profile.completed_rescues}</p>
              <p className="text-label-sm text-on-surface-variant">Rescues</p>
            </div>
            <div>
              <p className="text-headline-sm font-bold text-primary">{profile.total_hours}</p>
              <p className="text-label-sm text-on-surface-variant">Hours</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-stack-md lg:col-span-2">
          <h2 className="text-headline-sm text-primary">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" value={form.phone ?? ""} onChange={setStr("phone")} />
            <Input label="Role title" value={form.role_title ?? ""} onChange={setStr("role_title")} />
            <Input label="Availability" value={form.availability ?? ""} onChange={setStr("availability")} />
            <Input label="Emergency contact" value={form.emergency_contact ?? ""} onChange={setStr("emergency_contact")} />
            <Input
              label="Working radius (km)"
              type="number"
              value={form.working_radius_km ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, working_radius_km: e.target.value === "" ? undefined : Number(e.target.value) }))}
            />
          </div>
          <Input label="Skills (comma-separated)" value={(form.skills ?? []).join(", ")} onChange={setCsv("skills")} />
          <Input label="Certifications (comma-separated)" value={(form.certifications ?? []).join(", ")} onChange={setCsv("certifications")} />
          <Input label="Languages (comma-separated)" value={(form.languages ?? []).join(", ")} onChange={setCsv("languages")} />
          <Textarea label="Schedule notes" rows={2} value={form.schedule ?? ""} onChange={setStr("schedule")} />
        </Card>

        <Card className="flex flex-col gap-4 p-stack-md lg:col-span-3">
          <div>
            <h2 className="text-headline-sm text-primary">How you contribute</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Choose whether you&apos;re available to any nearby verified NGO, or
              affiliate with a preferred organisation. You can change this at any time.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => mode.mutate({ mode: "independent" })}
              disabled={mode.isPending}
              className={`flex flex-col gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
                profile.assignment_mode === "independent"
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant hover:border-outline"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon name="explore" className="text-[22px] text-primary" />
                <span className="text-label-md font-semibold text-on-surface">Independent</span>
                {profile.assignment_mode === "independent" && (
                  <Icon name="check_circle" className="ml-auto text-[20px] text-primary" filled />
                )}
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Available for any nearby verified NGO when you&apos;re online.
              </p>
            </button>

            <div
              className={`flex flex-col gap-3 rounded-lg border-2 p-4 transition-colors ${
                profile.assignment_mode === "ngo_affiliated"
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon name="corporate_fare" className="text-[22px] text-primary" />
                <span className="text-label-md font-semibold text-on-surface">NGO volunteer</span>
                {profile.assignment_mode === "ngo_affiliated" && (
                  <Icon name="check_circle" className="ml-auto text-[20px] text-primary" filled />
                )}
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Primarily receive assignments from a preferred NGO. You can leave anytime.
              </p>
              <Select
                aria-label="Preferred NGO"
                placeholder="Select an NGO"
                options={(ngos ?? []).map((n) => ({ value: n.id, label: n.name }))}
                value={selectedNgo}
                onChange={(e) => setSelectedNgo(e.target.value)}
              />
              <Button
                size="sm"
                disabled={mode.isPending || !selectedNgo}
                onClick={() => mode.mutate({ mode: "ngo_affiliated", ngoId: selectedNgo })}
              >
                {profile.assignment_mode === "ngo_affiliated" && profile.ngo_id === selectedNgo
                  ? "Affiliated"
                  : "Affiliate with this NGO"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
