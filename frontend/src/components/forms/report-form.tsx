"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FieldShell } from "@/components/ui/field";
import { ReportSuccess } from "./report-success";
import { ImageUpload, type PreviewFile } from "./image-upload";
import { DynamicLocationPicker, type LatLng } from "@/components/maps/dynamic-location-picker";
import { useToast } from "@/components/notifications/toast";
import { reportsApi } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import type { ReportCreateResponse, SituationType, ReportPriority } from "@/lib/api/types";

const urgencyOptions = [
  { value: "critical", label: "Critical: immediate danger" },
  { value: "high", label: "High: urgent need" },
  { value: "medium", label: "Medium: needs attention" },
  { value: "stable", label: "Stable: non-urgent" },
];

const situationOptions = [
  { value: "medical", label: "Medical emergency" },
  { value: "shelter", label: "Shelter / homelessness" },
  { value: "food", label: "Food / water" },
  { value: "safety", label: "Personal safety" },
  { value: "other", label: "Other" },
];

type Errors = Partial<Record<"situation" | "urgency" | "description" | "location", string>>;

export function ReportForm() {
  const toast = useToast();

  const [situation, setSituation] = useState("");
  const [urgency, setUrgency] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [address, setAddress] = useState("");
  const [images, setImages] = useState<PreviewFile[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<ReportCreateResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const created = await reportsApi.create({
        situation: situation as SituationType,
        priority: urgency as ReportPriority,
        description,
        address: address || null,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        reporter_name: reporterName || null,
        reporter_phone: reporterPhone || null,
      });
      if (images.length > 0) {
        try {
          await reportsApi.uploadImages(
            created.report_id,
            images.map((i) => i.file),
          );
        } catch (e) {
          // Report is saved; surface a soft warning about the images.
          toast.warning(
            "Report saved, but images failed to upload",
            normalizeError(e).message,
          );
        }
      }
      return created;
    },
    onSuccess: (created) => {
      setResult(created);
      toast.success("Report submitted", `Your tracking ID is ${created.tracking_id}.`);
    },
    onError: (e) => {
      toast.error("Couldn't submit report", normalizeError(e).message);
    },
  });

  const validate = (): boolean => {
    const next: Errors = {};
    if (!situation) next.situation = "Select the type of situation";
    if (!urgency) next.urgency = "Select an urgency level";
    if (description.trim().length < 15)
      next.description = "Add a little more detail (at least 15 characters)";
    if (!location && !address.trim())
      next.location = "Set a location on the map, or enter an address";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  const reset = () => {
    setSituation("");
    setUrgency("");
    setDescription("");
    setReporterName("");
    setReporterPhone("");
    setLocation(null);
    setAddress("");
    setImages([]);
    setErrors({});
    setResult(null);
  };

  if (result) {
    return (
      <Card className="p-stack-lg">
        <ReportSuccess trackingId={result.tracking_id} onReset={reset} />
      </Card>
    );
  }

  return (
    <Card className="p-stack-lg">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
          <Icon name="emergency" className="mt-0.5 text-[20px] text-on-warning-soft" />
          <p className="text-body-sm text-on-warning-soft">
            If someone is in immediate, life-threatening danger, contact your local emergency
            services first, then file this report.
          </p>
        </div>

        {/* Location */}
        <FieldShell
          label="Location"
          required
          error={errors.location}
          hint={address ? `Selected: ${address}` : undefined}
        >
          <DynamicLocationPicker
            value={location}
            onChange={(latlng, resolvedAddress) => {
              setLocation(latlng);
              if (resolvedAddress) setAddress(resolvedAddress);
              setErrors((p) => ({ ...p, location: undefined }));
            }}
            onError={(msg) => toast.warning("Location", msg)}
          />
        </FieldShell>

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            name="situation"
            label="Type of situation"
            required
            placeholder="Select a category"
            options={situationOptions}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            error={errors.situation}
          />
          <Select
            name="urgency"
            label="Urgency"
            required
            placeholder="Select urgency"
            options={urgencyOptions}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            error={errors.urgency}
          />
        </div>

        <Textarea
          name="description"
          label="Describe the situation"
          required
          rows={5}
          placeholder="What did you observe? How many people are involved? Any details that would help responders."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
        />

        {/* Images */}
        <FieldShell label="Photos (optional)">
          <ImageUpload
            files={images}
            onChange={setImages}
            max={6}
            onError={(msg) => toast.warning("Image", msg)}
          />
        </FieldShell>

        <div className="border-t border-outline-variant pt-5">
          <p className="mb-1 text-label-md font-semibold text-primary">Your details (optional)</p>
          <p className="mb-4 text-label-sm text-on-surface-variant">
            Reports can be anonymous, but contact details help responders verify and follow up.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              name="reporterName"
              label="Name"
              placeholder="Your name"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
            />
            <Input
              name="reporterPhone"
              label="Phone"
              type="tel"
              leadingIcon="call"
              placeholder="Contact number"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="success"
          size="lg"
          fullWidth
          leadingIcon={mutation.isPending ? undefined : "send"}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Submitting…" : "Submit Report"}
        </Button>
      </form>
    </Card>
  );
}
