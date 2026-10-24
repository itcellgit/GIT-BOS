import { useOutletContext } from "react-router";
import { roleLabels } from "@acp/shared/domain/auth/permissions";
import { roles } from "@acp/shared/schemas/config";
import { useApiQuery } from "@/hooks/use-api";
import { addRole, removeRole, resetPasswordToDefault, saveUser, setInitialPassword } from "@/lib/actions";
import {
  DataTablePagination,
  DataTableToolbar,
  NoResultsRow,
  SerialCell,
  SerialHead,
  SortableHead,
} from "@/components/data-table/data-table";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { useDataTable } from "@/hooks/use-data-table";
import { distinctOptions } from "@/lib/data-table";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/layout/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { KeyRound, Pencil, RotateCcwKey, ShieldPlus, UserPlus, X } from "lucide-react";
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

function Users({ users, departments, actorIsSuperAdmin, defaultPassword }) {
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

  const roleText = (u) =>
    u.roles.map((r) => roleLabels[r.role] + (r.department ? ` ${r.department.code}` : "")).join(" ");
  const table = useDataTable({
    id: "users",
    rows: users,
    columns: {
      name: { sortValue: (u) => u.name },
      email: { sortValue: (u) => u.email },
      roles: { sortValue: (u) => roleText(u) || null },
    },
    defaultSort: { key: "name", dir: "asc" },
    searchText: (u) => [u.name, u.email, u.designation, roleText(u)].join(" "),
    filterDefs: {
      role: (u, v) => u.roles.some((r) => r.role === v),
      department: (u, v) => u.roles.some((r) => r.department?.code === v),
      status: (u, v) => (v === "active" ? u.isActive : !u.isActive),
      signIn: (u, v) => (v === "password" ? u.hasPassword : !u.hasPassword),
    },
  });

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
      <div className="space-y-3">
        <DataTableToolbar
          table={table}
          noun="users"
          searchPlaceholder="Name, email, designation or role"
          filters={[
            {
              key: "role",
              label: "Role",
              allLabel: "All roles",
              options: roles.map((r) => ({ value: r, label: roleLabels[r] })),
            },
            {
              key: "department",
              label: "Department",
              allLabel: "All departments",
              width: "w-36",
              options: distinctOptions(users, (u) => u.roles.map((r) => r.department?.code)),
            },
            {
              key: "status",
              label: "Status",
              allLabel: "Active and inactive",
              width: "w-44",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
            {
              key: "signIn",
              label: "Password",
              allLabel: "Any",
              width: "w-36",
              options: [
                { value: "password", label: "Has a password" },
                { value: "none", label: "No password" },
              ],
            },
          ]}
        />
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <SerialHead />
                <SortableHead table={table} column="name">
                  Name
                </SortableHead>
                <SortableHead table={table} column="email">
                  Email
                </SortableHead>
                <SortableHead table={table} column="roles">
                  Roles
                </SortableHead>
                <TableHead className="w-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.total === 0 && <NoResultsRow table={table} colSpan={5} />}
              {table.rows.map((u, i) => {
                const isSuperAdmin = u.roles.some((r) => r.role === "SUPER_ADMIN");
                // Ordinary Administrators can see Super Admin accounts but not change them.
                const locked = isSuperAdmin && !actorIsSuperAdmin;
                return (
                  <TableRow key={u.id} className={u.isActive ? undefined : "opacity-60"}>
                    <SerialCell n={table.from + i} />
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
                          {actorIsSuperAdmin && u.id !== me.id && u.isActive && (
                            <ConfirmActionButton
                              action={resetPasswordToDefault.bind(null, u.id)}
                              label="Reset to default"
                              icon={RotateCcwKey}
                              title={`Reset password — ${u.name}?`}
                              description={`${u.name} is signed out everywhere and can then sign in with ${u.email} and the default password “${defaultPassword}” (Password option on the sign-in page), and must then choose a new password. Their current password, if any, stops working.`}
                              confirmLabel="Reset password"
                            />
                          )}
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
          <DataTablePagination table={table} />
        </div>
      </div>
    </>
  );
}
