import Link from "next/link";
import { AuthCard, AuthShell } from "../components/auth-components";

export default function DashboardPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Welcome to SELAP"
        description="You have signed in successfully."
      >
        <Link className="primaryButton" href="/auth/login">
          Back to Sign In
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
