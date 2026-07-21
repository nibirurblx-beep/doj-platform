import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import { SectionTabs } from "@/components/portal/section-tabs";

export const metadata = { title: "Employment register" };

const EMPLOYMENT_PERMISSIONS: string[] = [
  PERMISSIONS.APPLICATIONS_ALL_VIEW,
  PERMISSIONS.APPLICATIONS_DEPARTMENT_VIEW,
  PERMISSIONS.VACANCIES_MANAGE,
  PERMISSIONS.EMPLOYEES_ALL_VIEW,
  PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW,
  PERMISSIONS.EMPLOYEES_CREATE,
];

export default async function EmploymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Leadership and Platform Administrator only
  const permissions = await getMyPermissions();
  const allowed = permissions.some((p) =>
    EMPLOYMENT_PERMISSIONS.includes(p.permission_key),
  );
  if (!allowed) redirect("/portal?denied=Employment register");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Employment register</h1>
        <SectionTabs
          items={[
            { href: "/portal/employment/applications", label: "Applications" },
            { href: "/portal/employment/vacancies", label: "Vacancies" },
            { href: "/portal/employment/employees", label: "Employees" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
