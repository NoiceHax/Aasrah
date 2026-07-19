"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/notifications/toast";
import { adminApi } from "@/lib/api/admin";
import { normalizeError } from "@/lib/api/client";
import type { UserRole } from "@/lib/api/types";

const roleOptions = [
  { value: "", label: "All roles" },
  { value: "volunteer", label: "Volunteers" },
  { value: "ngo", label: "NGOs" },
  { value: "admin", label: "Admins" },
];

// `citizen` is retained only so legacy/deactivated accounts still render a
// badge; it is no longer an assignable role.
const roleBadge: Record<UserRole, "neutral" | "secondary" | "info" | "success"> = {
  citizen: "neutral",
  volunteer: "secondary",
  ngo: "info",
  admin: "success",
};

export default function UsersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", { search, role, page }],
    queryFn: () =>
      adminApi.users({
        search: search.trim() || undefined,
        role: (role || undefined) as UserRole | undefined,
        page,
        page_size: 20,
      }),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminApi.setUserActive(id, active),
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Account activated" : "Account suspended");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error("Action failed", normalizeError(e).message),
  });

  return (
    <>
      <ShellPageHeader title="User Management" description="Manage all platform accounts." />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <Card className="p-stack-md">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Search"
              leadingIcon="search"
              placeholder="Name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1"
            />
            <Select
              label="Role"
              options={roleOptions}
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="min-w-[160px]"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Name", "Email", "Role", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
                  ))
                ) : data && data.items.length > 0 ? (
                  data.items.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 font-medium text-primary">{u.full_name ?? "-"}</td>
                      <td className="px-4 py-3 text-body-sm text-on-surface-variant">{u.email}</td>
                      <td className="px-4 py-3"><Badge variant={roleBadge[u.role]}>{u.role}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge variant={u.is_active ? "success" : "danger"}>{u.is_active ? "Active" : "Suspended"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={u.is_active ? "outline" : "success"}
                          onClick={() => setActive.mutate({ id: u.id, active: !u.is_active })}
                        >
                          {u.is_active ? "Suspend" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-on-surface-variant">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
              <span className="text-label-sm text-on-surface-variant">Page {data.page} of {data.pages} · {data.total} users</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
