"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

type AuthRole = "ADMIN" | "CUSTOMER" | "SALES_AGENT" | null;

type CurrentUserResponse = {
  user: {
    role: AuthRole;
    name?: string;
    regions?: Array<{
      id: number;
      name: string;
      city: string | null;
      district: string | null;
    }>;
  };
};

export function RoleNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<AuthRole>(null);
  const [name, setName] = useState("");
  const [agentAreaLabel, setAgentAreaLabel] = useState("Area: Not assigned");

  useEffect(() => {
    const token = localStorage.getItem("selapAccessToken");
    const tokenRole = getRoleFromToken(token);
    setRole(tokenRole);

    if (!token) {
      return;
    }

    apiGet<CurrentUserResponse>("/auth/me", { token })
      .then((data) => {
        setRole(data.user.role ?? tokenRole);
        setName(data.user.name ?? "");

        if (data.user.role !== "SALES_AGENT") {
          return;
        }

        const regions = data.user.regions ?? [];
        setAgentAreaLabel(
          regions.length > 0
            ? `Area: ${regions.map((region) => region.name).join(", ")}`
            : "Area: Not assigned"
        );
      })
      .catch(() => {
        setRole(tokenRole);
      });
  }, []);

  function logout() {
    localStorage.removeItem("selapAccessToken");
    router.push("/auth/login");
  }

  return (
    <nav className="catalogMockNav">
      <Link className="catalogMockBrand" href="/properties">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="SELAP" className="catalogLogoImage" src="/selap-logo.svg" />
      </Link>
      <div className="catalogMockLinks">
        {role === "ADMIN" ? (
          <>
            <NavLink active={pathname === "/properties"} href="/properties">
              Catalog
            </NavLink>
            <NavLink active={pathname === "/properties/manage"} href="/properties/manage">
              Add Property
            </NavLink>
            <NavLink
              active={pathname === "/admin/staff-directory"}
              href="/admin/staff-directory"
            >
              Staff Directory
            </NavLink>
            <NavLink
              active={pathname === "/admin/pending-agents"}
              href="/admin/pending-agents"
            >
              Pending Agents
            </NavLink>
          </>
        ) : role === "SALES_AGENT" ? (
          <>
            <NavLink active={pathname === "/agent/leads"} href="#">
              Lead Inbox
            </NavLink>
            <NavLink active={pathname === "/properties"} href="/properties">
              Catalog
            </NavLink>
            <NavLink active={pathname === "/properties/manage"} href="/properties/manage">
              Add Property
            </NavLink>
            <span className="agentAreaBadge">{agentAreaLabel}</span>
          </>
        ) : (
          <>
            <NavLink active={pathname === "/properties"} href="/properties">
              Catalog
            </NavLink>
            <NavLink active={pathname === "/favorites"} href="/favorites">
              Favorites
            </NavLink>
            <NavLink active={pathname === "/notifications"} href="/notifications">
              Notifications
            </NavLink>
            {!role ? (
              <NavLink active={pathname === "/auth/login"} href="/auth/login">
                Sign In
              </NavLink>
            ) : null}
          </>
        )}
        <AccountMenu name={name} onLogout={logout} role={role} />
      </div>
    </nav>
  );
}

function NavLink({
  active,
  children,
  href
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link className={active ? "mockActiveNavItem" : undefined} href={href}>
      {children}
    </Link>
  );
}

function AccountMenu({
  name,
  onLogout,
  role
}: {
  name: string;
  onLogout: () => void;
  role: AuthRole;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (!role) {
    return <span className="mockAvatar mockCustomerAvatar" aria-label="Customer account"><span /></span>;
  }

  return (
    <div className="accountMenu">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open account menu"
        className="mockAvatar mockRoleAvatar accountMenuTrigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {initials || (role === "ADMIN" ? "AD" : "A")}
      </button>
      {isOpen ? (
        <div className="accountDropdown" role="menu">
          <span className="accountRole">{role === "SALES_AGENT" ? "Sales Agent" : role === "ADMIN" ? "Administrator" : "Customer"}</span>
          {name ? <strong>{name}</strong> : null}
          <button onClick={onLogout} role="menuitem" type="button">Log out</button>
        </div>
      ) : null}
    </div>
  );
}

function getRoleFromToken(token: string | null): AuthRole {
  if (!token) {
    return null;
  }

  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = JSON.parse(
      window.atob(
        normalizedPayload.padEnd(
          Math.ceil(normalizedPayload.length / 4) * 4,
          "="
        )
      )
    ) as { role?: AuthRole };

    return decodedPayload.role ?? null;
  } catch {
    return null;
  }
}
