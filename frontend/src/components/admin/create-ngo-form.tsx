"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/notifications/toast";
import { adminApi } from "@/lib/api/admin";
import { normalizeError } from "@/lib/api/client";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"name" | "owner_email" | "temp_password", string>>;

/**
 * Admin-only form to provision an NGO. Creates the NGO record plus an owner
 * user account (NGO role) with a temporary password the admin communicates
 * out-of-band. There is no public NGO registration.
 */
export function CreateNgoForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();

  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [location, setLocation] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("25");
  const [errors, setErrors] = useState<Errors>({});

  const create = useMutation({
    mutationFn: () =>
      adminApi.createNgo({
        name: name.trim(),
        owner_email: ownerEmail.trim(),
        temp_password: tempPassword,
        owner_full_name: ownerName.trim() || undefined,
        focus_area: focusArea.trim() || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        service_latitude: lat.trim() === "" ? null : Number(lat),
        service_longitude: lng.trim() === "" ? null : Number(lng),
        service_radius_km: radius.trim() === "" ? 25 : Number(radius),
        verified: true,
      }),
    onSuccess: (ngo) => {
      toast.success("NGO created", `${ngo.name} is active. Share the temporary password with the owner.`);
      onCreated();
    },
    onError: (e) => toast.error("Couldn't create NGO", normalizeError(e).message),
  });

  const validate = (): boolean => {
    const next: Errors = {};
    if (!name.trim()) next.name = "Organization name is required";
    if (!emailRe.test(ownerEmail.trim())) next.owner_email = "Enter a valid owner email";
    if (tempPassword.length < 8) next.temp_password = "At least 8 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) create.mutate();
  };

  return (
    <Card className="p-stack-md">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-headline-sm text-primary">Create an NGO</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            This provisions the organization and an owner login. The owner signs in with the
            temporary password and can change it via “forgot password”.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Organization name"
            required
            leadingIcon="corporate_fare"
            placeholder="Hope Foundation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="Focus area"
            leadingIcon="category"
            placeholder="Disaster relief"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
          />
          <Input
            label="Owner email"
            type="email"
            required
            leadingIcon="mail"
            placeholder="owner@organization.org"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            error={errors.owner_email}
          />
          <Input
            label="Owner name"
            leadingIcon="person"
            placeholder="Full name (optional)"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          <Input
            label="Temporary password"
            type="text"
            required
            leadingIcon="key"
            placeholder="At least 8 characters"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            error={errors.temp_password}
            hint="Shared with the owner; they change it on first login."
          />
          <Input
            label="Contact phone"
            leadingIcon="call"
            placeholder="Optional"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Input
            label="Location"
            leadingIcon="location_on"
            placeholder="City, region"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Service latitude"
            type="number"
            step="any"
            placeholder="Optional"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <Input
            label="Service longitude"
            type="number"
            step="any"
            placeholder="Optional"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
          <Input
            label="Service radius (km)"
            type="number"
            step="any"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        </div>

        <Textarea
          label="Description"
          rows={2}
          placeholder="Short description of the organization (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" leadingIcon="add_business" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create NGO"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
