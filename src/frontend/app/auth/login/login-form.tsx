"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthFooter,
  Field,
  RoleSelector,
  SubmitButton
} from "../../components/auth-components";
import { apiPost } from "../../lib/api";

type LoginResponse = {
  accessToken: string;
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await apiPost<LoginResponse>("/auth/login", {
        body: {
          phone: formData.get("phone"),
          password: formData.get("password"),
          role: formData.get("role")
        }
      });

      localStorage.setItem("selapAccessToken", response.accessToken);
      router.push("/properties");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Sign in failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="formStack" onSubmit={handleSubmit}>
        <RoleSelector defaultRole="Admin" />
        <Field
          autoComplete="tel"
          label="PHONE NUMBER"
          name="phone"
          placeholder="+84 908 123 456"
          type="tel"
        />
        <Field
          autoComplete="current-password"
          label="PASSWORD"
          name="password"
          placeholder="Enter your password"
          type="password"
        />
        {error ? <p className="errorNotice">{error}</p> : null}
        <SubmitButton>{isSubmitting ? "Signing In..." : "Sign In"}</SubmitButton>
      </form>

      <Link className="inlineLink" href="/auth/forgot-password">
        Forgot password?
      </Link>
      <AuthFooter
        href="/auth/register"
        label="Create account"
        prompt="Do not have an account?"
      />
    </>
  );
}
