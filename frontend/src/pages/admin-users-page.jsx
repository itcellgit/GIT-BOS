import { useOutletContext } from "react-router";
import { roleLabels } from "@acp/shared/domain/auth/permissions";
import { roles } from "@acp/shared/schemas/config";
import { useApiQuery } from "@/hooks/use-api";
import { addRole, removeRole, saveUser, setInitialPassword } from "@/lib/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { KeyRound, Pencil, ShieldPlus, UserPlus, X } from "lucide-react";
const userFields = [
  { name: "name", label: "Full name", type: "text", width: "half" },
  { name: "email", label: "Email", type: "email", width: "half", description: "Used to sign in." },
  { name: "designation", label: "Designation", type: "text", width: "half", placeholder: "e.g. Associate Professor" },
  { name: "isActive", label: "Active (can sign in)", type: "checkbox", width: "half" },
];

const passwordFields = [
  {
    name: "password",
    label: "Initial password",
    type: "password",
    description: "At least 12 characters, with letters and digits.",
  },
  { name: "confirmPassword", label: "Confirm password", type: "password" },
];

export function AdminUsersPage() {
  const query = useApiQuery("/admin/users");
  return <QueryState query={query}>{(data) => <Users {...data} />}</QueryState>;
}

function Users({ users, departments, actorIsSuperAdmin }) {
  const { me } = useOutletContext();
  const roleFields = [
    {
      name: "role",
      label: "Role",
      type: "select",
      // Only a Super Admin can make someone a Super Admin.
      options: roles
        .filter((r) => r !== "SUPER_ADMIN" || actorIsSuperAdmin)
        .map((r) => ({ value: r, label: roleLabels[r] })),
      width: "half",
    },
    {
      name: "departmentId",
      label: "Department",
      type: "select",
      emptyLabel: "— Institution-wide —",
      options: departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` })),
      width: "half",
      description: "Required for BoS Coordinator, HoD and Faculty.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Only people listed here can sign in. Roles decide what each person can see and change."
        actions={
          <EntityFormDialog
            schema="user"
            title="Add user"
            fields={userFields}
            defaultValues={{ name: "", email: "", designation: "", isActive: true }}
            action={saveUser.bind(null, null)}
            trigger={
              <Button>
                <UserPlus />
                Add user
              </Button>
            }
          />
        }
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-0 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSuperAdmin = u.roles.some((r) => r.role === "SUPER_ADMIN");
              // Ordinary Administrators can see Super Admin accounts but not change them.
              const locked = isSuperAdmin && !actorIsSuperAdmin;
              return (
                <TableRow key={u.id} className={u.isActive ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.designation ?? ""}
                      {!u.isActive && " · inactive"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.email}
                    {u.hasPassword ? (
                      <div className="text-xs text-muted-foreground">
                        Password sign-in{u.passwordChangeRequired && " · must change at next sign-in"}
                      </div>
                    ) : (
                      isSuperAdmin && (
                        <div className="text-xs text-warning-foreground dark:text-warning">No password set</div>
                      )
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No role</span>}
                      {u.roles.map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1">
                          <Badge variant={r.role === "SUPER_ADMIN" ? "default" : "secondary"}>
                            {roleLabels[r.role]}
                            {r.department ? ` · ${r.department.code}` : ""}
                          </Badge>
                          {!locked && (r.role !== "SUPER_ADMIN" || actorIsSuperAdmin) && (
                            <ConfirmActionButton
                              action={removeRole.bind(null, r.id)}
                              label="Remove role"
                              icon={X}
                              iconOnly
                              size="xs"
                              variant="ghost"
                              title="Remove role?"
                              description={`Remove “${roleLabels[r.role]}${r.department ? ` (${r.department.code})` : ""}” from ${u.name}.`}
                              confirmLabel="Remove"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {locked ? (
                      <p className="text-right text-xs text-muted-foreground">Managed by Super Admins</p>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {isSuperAdmin && actorIsSuperAdmin && u.id !== me.id && u.isActive && (
                          <EntityFormDialog
                            schema="initialPassword"
                            title={`${u.hasPassword ? "Reset" : "Set"} password — ${u.name}`}
                            description="The user is signed out everywhere and must choose their own password at the next sign-in. Share this password with them securely."
                            fields={passwordFields}
                            defaultValues={{ password: "", confirmPassword: "" }}
                            action={setInitialPassword.bind(null, u.id)}
                            submitLabel="Set password"
                            trigger={
                              <Button variant="outline" size="sm">
                                <KeyRound />
                                {u.hasPassword ? "Reset password" : "Set password"}
                              </Button>
                            }
                          />
                        )}
                        <EntityFormDialog
                          schema="roleAssignment"
                          title={`Add role — ${u.name}`}
                          fields={roleFields}
                          defaultValues={{ role: "FACULTY", departmentId: "" }}
                          action={addRole.bind(null, u.id)}
                          trigger={
                            <Button variant="outline" size="sm">
                              <ShieldPlus />
                              Add role
                            </Button>
                          }
                        />
                        <EntityFormDialog
                          schema="user"
                          title="Edit user"
                          fields={userFields}
                          defaultValues={{
                            name: u.name,
                            email: u.email,
                            designation: u.designation ?? "",
                            isActive: u.isActive,
                          }}
                          action={saveUser.bind(null, u.id)}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Pencil />
                              Edit
                            </Button>
                          }
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
