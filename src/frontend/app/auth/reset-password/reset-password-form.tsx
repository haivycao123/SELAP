"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SubmitButton } from "../../components/auth-components";
import { apiPost } from "../../lib/api";

export function ResetPasswordForm() {
  const router = useRouter();
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setResetToken(sessionStorage.getItem("passwordResetToken") ?? "");
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      await apiPost("/auth/reset-password", {
        body: {
          resetToken,
          newPassword: formData.get("password")
        }
      });

      sessionStorage.removeItem("passwordResetToken");
      router.push("/auth/login");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Password reset failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="formStack" onSubmit={handleSubmit}>
      <Field
        autoComplete="new-password"
        label="NEW PASSWORD"
        name="password"
        placeholder="Create a new password"
        type="password"
      />
      {error ? <p className="errorNotice">{error}</p> : null}
      <SubmitButton>
        {isSubmitting ? "Resetting..." : "Reset Password"}
      </SubmitButton>
    </form>
  );
}
