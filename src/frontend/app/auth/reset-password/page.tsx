import {
  AuthCard,
  AuthShell
} from "../../components/auth-components";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Create New Password"
        description="Choose a new password for your SELAP account."
      >
        <ResetPasswordForm />
      </AuthCard>
    </AuthShell>
  );
}
