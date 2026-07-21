import Link from "next/link";
import { AuthCard, AuthShell } from "../components/auth-components";

export default function DashboardPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Welcome to SELAP"
        description="You have signed in successfully."
      >
        <div className="dashboardActions">
          <Link className="primaryButton" href="/properties">
            Browse Catalog
          </Link>
          <Link className="primaryButton secondaryDashboardButton" href="/properties/manage">
            Manage Properties
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
