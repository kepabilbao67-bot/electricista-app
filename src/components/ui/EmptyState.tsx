import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./Button";
import { Plus } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white/50 backdrop-blur-sm animate-fade-in my-4">
      <div className="relative mb-4 flex h-24 w-24 items-center justify-center">
        {icon ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            {icon}
          </div>
        ) : (
          <Image
            src="/images/empty-state.svg"
            alt="Sin datos"
            width={96}
            height={96}
            className="opacity-90"
          />
        )}
      </div>
      <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>
      
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button variant="primary" size="md">
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        </Link>
      )}

      {actionLabel && !actionHref && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
