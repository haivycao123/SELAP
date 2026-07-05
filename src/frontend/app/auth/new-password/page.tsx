import { redirect } from "next/navigation";

export default function NewPasswordRedirectPage() {
  redirect("/auth/reset-password");
}
