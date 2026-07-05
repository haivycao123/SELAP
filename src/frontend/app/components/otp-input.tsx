"use client";

import { useRef } from "react";

export function OtpInput({ namePrefix = "code" }: { namePrefix?: string }) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  return (
    <div className="otpGroup" aria-label="Verification code">
      {[0, 1, 2, 3].map((index) => (
        <input
          aria-label={`Digit ${index + 1}`}
          inputMode="numeric"
          key={index}
          maxLength={1}
          name={`${namePrefix}-${index + 1}`}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, "").slice(-1);
            event.target.value = value;

            if (value && index < 3) {
              inputRefs.current[index + 1]?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Backspace" &&
              !event.currentTarget.value &&
              index > 0
            ) {
              inputRefs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();

            const digits = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, 4)
              .split("");

            digits.forEach((digit, digitIndex) => {
              const input = inputRefs.current[digitIndex];

              if (input) {
                input.value = digit;
              }
            });

            inputRefs.current[Math.min(digits.length, 3)]?.focus();
          }}
          pattern="[0-9]"
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          required
          type="text"
        />
      ))}
    </div>
  );
}
