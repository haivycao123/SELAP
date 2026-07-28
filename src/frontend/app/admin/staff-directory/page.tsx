"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleNavigation } from "../../components/role-navigation";
import { apiGet } from "../../lib/api";

type StaffRole = "ADMIN" | "SALES_AGENT";
type StaffStatus = "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";

type Region = {
  id: number;
  name: string;
  code: string;
  city: string | null;
  district: string | null;
  ward: string | null;
  assignedAt: string;
};

type StaffMember = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: StaffStatus;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  approvedBy: { id: number; name: string } | null;
  rejectedBy: { id: number; name: string } | null;
  regions: Region[];
  stats: {
    assignedLeads: number;
    createdProperties: number;
  };
};

type StaffResponse = {
  data: StaffMember[];
};

const roleOptions: Array<"ALL" | StaffRole> = ["ALL", "ADMIN", "SALES_AGENT"];
const statusOptions: Array<"ALL" | StaffStatus> = [
  "ALL",
  "ACTIVE",
  "PENDING",
  "REJECTED",
  "SUSPENDED"
];

export default function StaffDirectoryPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | StaffRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StaffStatus>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStaff = useCallback(async (accessToken: string) => {
    setError("");
    const response = await apiGet<StaffResponse>("/admin/staff", {
      token: accessToken
    });
    setStaff(response.data);
  }, []);

  useEffect(() => {
    const accessToken = localStorage.getItem("selapAccessToken");

    if (!accessToken) {
      setError("Please sign in as Admin to view the staff directory.");
      setIsLoading(false);
      return;
    }

    loadStaff(accessToken)
      .catch((caughtError) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load staff directory."
        );
      })
      .finally(() => setIsLoading(false));
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesRole = roleFilter === "ALL" || member.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" || member.status === statusFilter;
      const searchableText = [
        member.name,
        member.email,
        member.phone,
        member.role,
        member.status,
        member.regions.map(formatRegion).join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return matchesRole && matchesStatus && searchableText.includes(query);
    });
  }, [roleFilter, search, staff, statusFilter]);

  const totals = useMemo(
    () => ({
      active: staff.filter((member) => member.status === "ACTIVE").length,
      admins: staff.filter((member) => member.role === "ADMIN").length,
      pending: staff.filter((member) => member.status === "PENDING").length,
      salesAgents: staff.filter((member) => member.role === "SALES_AGENT").length
    }),
    [staff]
  );

  return (
    <main className="catalogMockPage staffDirectoryPage">
      <div className="catalogMockShell">
        <RoleNavigation />

        <header className="staffHeader">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Staff Directory</h1>
          </div>
          <div className="staffSummary">
            <SummaryStat label="Admins" value={totals.admins} />
            <SummaryStat label="Sales Agents" value={totals.salesAgents} />
            <SummaryStat label="Active" value={totals.active} />
            <SummaryStat label="Pending" value={totals.pending} />
          </div>
        </header>

        {error ? <p className="approvalError staffNotice">{error}</p> : null}

        <section className="staffToolbar">
          <label>
            <span>Search staff</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, phone, area..."
              value={search}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              onChange={(event) =>
                setRoleFilter(event.target.value as "ALL" | StaffRole)
              }
              value={roleFilter}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | StaffStatus)
              }
              value={statusFilter}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="staffPanel">
          <div className="staffTableHead">
            <span>Staff Member</span>
            <span>Role</span>
            <span>Status</span>
            <span>Assigned Areas</span>
            <span>Activity</span>
            <span>Joined</span>
          </div>

          {isLoading ? (
            <p className="approvalEmpty">Loading staff directory...</p>
          ) : null}

          {!isLoading && filteredStaff.length === 0 ? (
            <p className="approvalEmpty">No staff members match this view.</p>
          ) : null}

          {!isLoading
            ? filteredStaff.map((member) => (
                <article className="staffRow" key={member.id}>
                  <div className="agentIdentity">
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                    <span>{member.phone}</span>
                  </div>
                  <span className="staffRolePill">{formatRole(member.role)}</span>
                  <span className={`staffStatusPill staffStatus-${member.status}`}>
                    {formatStatusLabel(member.status)}
                  </span>
                  <div className="staffRegions">
                    {member.regions.length > 0 ? (
                      member.regions.map((region) => (
                        <span key={region.id}>{formatRegion(region)}</span>
                      ))
                    ) : (
                      <em>{member.role === "ADMIN" ? "All areas" : "Not assigned"}</em>
                    )}
                  </div>
                  <div className="staffActivity">
                    <span>{member.stats.createdProperties} properties</span>
                    <span>{member.stats.assignedLeads} leads</span>
                  </div>
                  <div className="staffDates">
                    <strong>{formatDate(member.createdAt)}</strong>
                    {member.approvedBy ? (
                      <span>Approved by {member.approvedBy.name}</span>
                    ) : null}
                    {member.rejectedBy ? (
                      <span>Rejected by {member.rejectedBy.name}</span>
                    ) : null}
                  </div>
                </article>
              ))
            : null}
        </section>
      </div>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatRole(role: "ALL" | StaffRole) {
  if (role === "ALL") return "All roles";
  return role === "SALES_AGENT" ? "Sales Agent" : "Admin";
}

function formatStatusLabel(status: "ALL" | StaffStatus) {
  if (status === "ALL") return "All statuses";
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function formatRegion(region: Region) {
  return [region.name, region.district, region.city].filter(Boolean).join(" - ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
