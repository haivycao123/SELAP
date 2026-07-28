import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
export { OtpInput } from "./otp-input";

type Role = "Admin" | "Sales Agent" | "Customer";

const roles: Role[] = ["Admin", "Sales Agent", "Customer"];
const roleValues: Record<Role, string> = {
  Admin: "ADMIN",
  "Sales Agent": "SALES_AGENT",
  Customer: "CUSTOMER"
};

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="authPage">
      <section className="authShell">
        <header className="authHeader">
          <Link className="brandLockup" href="/auth/login">
            <LogoMark />
            <span>SELAP</span>
          </Link>
        </header>

        <div className="authStage">{children}</div>
      </section>
    </main>
  );
}

function LogoMark() {
  return (
    <svg
      aria-hidden="true"
      className="brandLogo"
      focusable="false"
      viewBox="0 0 36 36"
    >
      <circle cx="18" cy="18" fill="#ffffff" r="16" stroke="#111111" strokeWidth="2.2" />
      <path d="M6 29 H30" stroke="#111111" strokeLinecap="round" strokeWidth="2.4" />
      <path
        d="M9 14 L18 18 V29 H9 Z"
        fill="#8db3df"
        stroke="#111111"
        strokeLinejoin="miter"
        strokeWidth="1.9"
      />
      <path
        d="M18 8 L29 2.5 V22 L18 26 Z"
        fill="#c4c8c7"
        stroke="#111111"
        strokeLinejoin="miter"
        strokeWidth="1.9"
      />
      <path
        d="M16 24 L33 18 V29 H16 Z"
        fill="#f5a93a"
        stroke="#111111"
        strokeLinejoin="miter"
        strokeWidth="1.9"
      />
      <rect fill="#111111" height="3" width="3" x="12.5" y="20" />
      <rect fill="#111111" height="3" width="3" x="12.5" y="25" />
      <rect fill="#111111" height="3" width="3" x="23" y="11" />
      <rect fill="#111111" height="3" width="3" x="23" y="16" />
      <rect fill="#111111" height="2.8" width="2.8" x="24" y="25" />
      <rect fill="#111111" height="2.8" width="2.8" x="28" y="25" />
    </svg>
  );
}

export function AuthCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="authCard">
      <h1>{title}</h1>
      <p className="panelLead">{description}</p>
      {children}
    </section>
  );
}

export function RoleSelector({ defaultRole, roles: allowedRoles }: { defaultRole: Role; roles?: Role[] }) {
  const visibleRoles = allowedRoles ?? roles;
  return (
    <fieldset className="roleTabs">
      <legend>ROLE</legend>
      {visibleRoles.map((role) => (
        <label key={role}>
          <input
            defaultChecked={role === defaultRole}
            name="role"
            type="radio"
            value={roleValues[role]}
          />
          <span>{role}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Field({
  label,
  name,
  placeholder,
  type = "text",
  autoComplete,
  required = true,
  value,
  onChange
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="primaryButton" type="submit">
      {children}
    </button>
  );
}

export function AuthFooter({
  prompt,
  href,
  label
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="authFooter">
      {prompt} <Link href={href}>{label}</Link>
    </p>
  );
}
