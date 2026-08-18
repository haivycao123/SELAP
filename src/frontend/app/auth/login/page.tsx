import {
  AuthCard,
  AuthShell
} from "../../components/auth-components";
import { LoginForm } from "./login-form";
import { Toast } from "../../components/toast";
export default function LoginPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Sign In"
        description="Access your SELAP workspace with your assigned role."
      >
        <LoginForm />
      </AuthCard>
    </AuthShell>
  );
}
