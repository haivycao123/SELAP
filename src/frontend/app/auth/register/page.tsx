import {
  AuthCard,
  AuthShell
} from "../../components/auth-components";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AuthShell>
      <AuthCard
        title="Create Account"
        description="Register your account, then verify your email before signing in."
      >
        <RegisterForm />
      </AuthCard>
    </AuthShell>
  );
}
