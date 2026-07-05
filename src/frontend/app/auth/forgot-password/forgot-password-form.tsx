"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, OtpInput, SubmitButton } from "../../components/auth-components";
import { apiPost, getOtpCode } from "../../lib/api";

type VerifyResetCodeResponse = {
  resetToken: string;
};

export function ForgotPasswordForm() {
  const router = useRouter();
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");

    try {
      await apiPost("/auth/forgot-password", {
        body: { email: submittedEmail }
      });
      setEmail(submittedEmail);
      setCodeSent(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not send reset code. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await apiPost<VerifyResetCodeResponse>(
        "/auth/verify-reset-code",
        {
          body: {
            email,
            code: getOtpCode(formData, "reset-code")
          }
        }
      );

      sessionStorage.setItem("passwordResetToken", response.resetToken);
      router.push("/auth/reset-password");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Code verification failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!codeSent) {
    return (
      <>
        <form
          className="formStack"
          onSubmit={handleSendCode}
        >
          <Field
            autoComplete="email"
            label="EMAIL"
            name="email"
            placeholder="customer@selap.vn"
            type="email"
          />
          {error ? <p className="errorNotice">{error}</p> : null}
          <SubmitButton>
            {isSubmitting ? "Sending..." : "Send Code"}
          </SubmitButton>
        </form>

        <p className="authFooter">
          Remember your password? <Link href="/auth/login">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="successNotice">A 4-digit code has been sent to your email.</p>
      <form className="formStack" onSubmit={handleVerifyCode}>
        <label className="field">
          <span>VERIFICATION CODE</span>
          <OtpInput namePrefix="reset-code" />
        </label>
        {error ? <p className="errorNotice">{error}</p> : null}
        <SubmitButton>
          {isSubmitting ? "Verifying..." : "Verify Code"}
        </SubmitButton>
      </form>

      <button
        className="textButton"
        onClick={() => setCodeSent(false)}
        type="button"
      >
        Use another email
      </button>
    </>
  );
}
