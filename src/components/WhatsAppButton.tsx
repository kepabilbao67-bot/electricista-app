"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { buildWhatsAppUrl } from "@/lib/phone";

interface WhatsAppButtonProps {
  phone: string;
  /** Pre-filled message. Variables like {nombre} should be resolved before passing. */
  message?: string;
  /** Button label. Defaults to "WhatsApp" */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Callback when the link is opened */
  onOpen?: () => void;
}

export default function WhatsAppButton({
  phone,
  message = "",
  label = "WhatsApp",
  className = "",
  compact = false,
  onOpen,
}: WhatsAppButtonProps) {
  const [opened, setOpened] = useState(false);

  if (!phone?.trim()) return null;

  const result = buildWhatsAppUrl(phone, message);
  if (!result.valid || !result.url || !result.international) return null;
  const href = result.url;
  const normalized = result.international;

  const handleClick = () => {
    setOpened(true);
    onOpen?.();
  };

  if (compact) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`inline-flex items-center justify-center rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 transition-colors ${opened ? "ring-1 ring-emerald-200" : ""} ${className}`}
        title={`Abrir WhatsApp: ${normalized}`}
      >
        <MessageCircle className="h-4 w-4" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 transition-all ${opened ? "ring-1 ring-emerald-300" : ""} ${className}`}
      title={`Abrir WhatsApp: ${normalized}`}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  );
}
