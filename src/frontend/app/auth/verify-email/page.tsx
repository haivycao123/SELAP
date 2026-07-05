import {
  AuthCard,
  AuthShell
} from "../../components/auth-components";
import { VerifyEmailForm } from "./verify-email-form";

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Verify Your Email"
        description="Enter the 4-digit code sent to your registered email."
      >
        <VerifyEmailForm />
      </AuthCard>
    </AuthShell>
  );
}
