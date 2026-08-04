"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiGet } from "../lib/api";
import { Toast } from "./toast";

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

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

    // Lắng nghe Real-time Socket cho Customer
    if (tokenRole === "CUSTOMER" && token) {
      const socket: Socket = io("http://localhost:3001/claiming", {
        auth: { token },
        transports: ["websocket", "polling"],
      });

       socket.on("lead_accepted", (data: { leadId: number; agentName: string; propertyTitle?: string; message?: string }) => {
        // Tăng đếm số thông báo chưa đọc trên Navigation Badge
        setUnreadCount((prev) => prev + 1);

        // Phát thông báo Toast nổi bật
        const toastText = data.message || `Your consultation request for ${data.propertyTitle || "Property"} has been accepted by ${data.agentName}. They will contact you shortly.`;

        setToast({
          message: toastText,
          type: "success",
        });

        try {
          new Audio("/sounds/lead-notification.mp3").play().catch(() => {});
        } catch {}
      });

      return () => {
        socket.disconnect();
      };
    }

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
            <NavLink active={pathname === "/agent/leads"} href="/agent/leads">
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
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                Notifications
                {unreadCount > 0 && (
                  <span
                    style={{
                      marginLeft: "6px",
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "10px",
                      padding: "2px 6px",
                      lineHeight: "1",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </span>
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={5000}
          onClose={() => setToast(null)}
        />
      )}
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
