/**
 * Champions Club — PasswordInput Component
 *
 * Reusable password input with visibility toggle (eye icon).
 * Supports all standard input props. Never logs or exposes the password.
 */

"use client";

import { useState, useCallback, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional extra CSS class for the wrapper element */
  wrapperClassName?: string;
}

/**
 * PasswordInput renders a password field with an eye-icon toggle button
 * that shows/hides the entered value without clearing or modifying it.
 */
export default function PasswordInput({
  wrapperClassName = "",
  className = "",
  id,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => setVisible((v) => !v), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <div className={`password-input-wrapper ${wrapperClassName}`} style={{ position: "relative", width: "100%" }}>
      <input
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        className={className}
        style={{ paddingRight: "2.75rem", boxSizing: "border-box", width: "100%" }}
      />
      <button
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={0}
        className="pw-toggle-btn"
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          padding: "4px",
          margin: "0",
          cursor: "pointer",
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          lineHeight: 1,
          width: "auto",
          height: "auto",
          boxShadow: "none",
          letterSpacing: "normal",
          textTransform: "none",
          fontWeight: "normal",
          fontSize: "inherit",
          transition: "color 0.2s",
        }}
      >
        {visible ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
