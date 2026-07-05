import {
  AuthCard,
  AuthShell
} from "../../components/auth-components";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Reset Password"
        description="Enter your email to receive a reset code."
      >
        <ForgotPasswordForm />
      </AuthCard>
    </AuthShell>
  );
}
