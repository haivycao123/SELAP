"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthFooter,
  Field,
  RoleSelector,
  SubmitButton
} from "../../components/auth-components";
import { apiPost } from "../../lib/api";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");

    try {
      await apiPost("/auth/register", {
        body: {
          name: formData.get("name"),
          email,
          phone: formData.get("phone"),
          password: formData.get("password"),
          role: formData.get("role")
        }
      });

      sessionStorage.setItem("pendingVerificationEmail", email);
      router.push("/auth/verify-email");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Registration failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="formStack" onSubmit={handleSubmit}>
        <RoleSelector defaultRole="Sales Agent" roles={["Sales Agent", "Customer"]} />
        <Field
          autoComplete="name"
          label="USER NAME"
          name="name"
          placeholder="Lena Nguyen"
        />
        <Field
          autoComplete="tel"
          label="PHONE NUMBER"
          name="phone"
          placeholder="+84 901 222 888"
          type="tel"
        />
        <Field
          autoComplete="email"
          label="EMAIL"
          name="email"
          placeholder="lena.nguyen@selap.vn"
          type="email"
        />
        <Field
          autoComplete="new-password"
          label="PASSWORD"
          name="password"
          placeholder="Create a password"
          type="password"
        />
        {error ? <p className="errorNotice">{error}</p> : null}
        <SubmitButton>{isSubmitting ? "Signing Up..." : "Sign Up"}</SubmitButton>
      </form>

      <AuthFooter
        href="/auth/login"
        label="Sign in"
        prompt="Already have an account?"
      />
    </>
  );
}
