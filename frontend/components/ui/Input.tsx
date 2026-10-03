/**
 * Champions Club — Input Component
 *
 * Reusable text input with label, error, and helper text support.
 */

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-cc-text-primary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2
            text-sm text-cc-text-primary
            bg-white
            border rounded-[var(--cc-radius-md)]
            transition-colors duration-[var(--cc-transition-fast)]
            placeholder:text-cc-text-muted
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${
              error
                ? "border-cc-error focus:ring-cc-error"
                : "border-cc-border focus:ring-cc-green-deep"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-cc-error" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-cc-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
