"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, OtpInput, SubmitButton } from "../../components/auth-components";
import { apiPost, getOtpCode } from "../../lib/api";

export function VerifyEmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setEmail(sessionStorage.getItem("pendingVerificationEmail") ?? "");
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? email);

    try {
      await apiPost("/auth/verify-email", {
        body: {
          email: submittedEmail,
          code: getOtpCode(formData, "email-code")
        }
      });

      sessionStorage.removeItem("pendingVerificationEmail");
      router.push("/auth/login");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Email verification failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setError("");
    setMessage("");

    try {
      await apiPost("/auth/resend-email-code", {
        body: { email }
      });
      setMessage("Verification code has been sent.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not resend code. Please try again."
      );
    }
  }

  return (
    <>
      <form className="formStack" onSubmit={handleSubmit}>
        <Field
          autoComplete="email"
          label="EMAIL"
          name="email"
          placeholder="lena.nguyen@selap.vn"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="field">
          <span>VERIFICATION CODE</span>
          <OtpInput namePrefix="email-code" />
        </label>
        {message ? <p className="successNotice">{message}</p> : null}
        {error ? <p className="errorNotice">{error}</p> : null}
        <SubmitButton>
          {isSubmitting ? "Verifying..." : "Verify Email"}
        </SubmitButton>
      </form>

      <button className="textButton" onClick={handleResendCode} type="button">
        Resend code
      </button>
    </>
  );
}
