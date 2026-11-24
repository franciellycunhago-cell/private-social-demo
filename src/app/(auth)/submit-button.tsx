"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold mt-2"
      style={{ padding: "15px", fontSize: 14, width: "100%" }}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}
