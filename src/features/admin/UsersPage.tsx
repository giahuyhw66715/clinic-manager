import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { getProfiles, updateProfileRole } from "@/lib/api";
import { formatDateTime, initials } from "@/lib/utils";
import type { UserRole } from "@/types";

const roleBadge: Record<UserRole, "default" | "secondary" | "warning" | "info"> = {
  patient: "secondary",
  doctor: "info",
  pharmacist: "warning",
  admin: "default",
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, UserRole>>({});

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const filtered = useMemo(
    () =>
      profiles.filter(
        (p) =>
          !search ||
          (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (p.phone ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [profiles, search],
  );

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      await updateProfileRole(id, role);
    },
    onSuccess: (_data, variables) => {
      toast.success("Role updated");
      setDraft((d) => {
        const next = { ...d };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Assign roles and manage accounts"
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, or phone..."
        className="max-w-sm"
      />

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-44">Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-24">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(user.full_name ?? "U")}
                      </span>
                      <div>
                        <p className="font-medium">{user.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{user.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.email}
                    <br />
                    {user.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    {draft[user.id] !== undefined ? (
                      <Select
                        value={draft[user.id]}
                        onValueChange={(value) => setDraft((d) => ({ ...d, [user.id]: value as UserRole }))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["patient", "doctor", "pharmacist", "admin"] as UserRole[]).map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Button
                        variant="ghost"
                        className="-mx-2 h-8"
                        onClick={() => setDraft((d) => ({ ...d, [user.id]: user.role }))}
                      >
                        <Badge variant={roleBadge[user.role]} className="capitalize">
                          {user.role}
                        </Badge>
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(user.created_at)}
                  </TableCell>
                  <TableCell>
                    {draft[user.id] !== undefined && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          roleMutation.mutate({ id: user.id, role: draft[user.id]! })
                        }
                        disabled={roleMutation.isPending}
                      >
                        <Save className="h-3 w-3" /> Save
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}