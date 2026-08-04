"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = "success", onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor =
    type === "success"
      ? "#10b981"
      : type === "error"
      ? "#ef4444"
      : type === "warning"
      ? "#f59e0b"
      : "#0284c7";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        backgroundColor: bgColor,
        color: "#ffffff",
        padding: "14px 20px",
        borderRadius: "10px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "14px",
        fontWeight: "600",
        zIndex: 9999,
        animation: "toastSlideIn 0.3s ease-out forwards",
      }}
    >
      <span>{type === "success" ? "✓" : type === "warning" ? "⚡" : "ℹ"}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "#ffffff",
          fontSize: "16px",
          cursor: "pointer",
          padding: "0 0 0 8px",
          lineHeight: 1,
          opacity: 0.8,
        }}
      >
        ✕
      </button>
      <style jsx>{`
        @keyframes toastSlideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}