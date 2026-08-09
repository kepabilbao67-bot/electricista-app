/**
 * Mapa de iconKey (string) → componente lucide-react.
 * Permite que la navegación se configure desde el servidor con strings
 * serializables y se resuelva a iconos en el cliente.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  Calendar,
  Zap,
  Package,
  Download,
  BookOpen,
  Receipt,
  BriefcaseBusiness,
  Bot,
  Cpu,
  Paintbrush,
  Building2,
  Wrench,
} from "lucide-react";

/**
 * Datos de navegación serializables (pasados desde Server Component).
 */
export interface NavItemData {
  href: string;
  label: string;
  iconKey: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "users": Users,
  "user-plus": UserPlus,
  "file-text": FileText,
  "clipboard-list": ClipboardList,
  "clipboard-check": ClipboardCheck,
  "message-square": MessageSquare,
  "calendar": Calendar,
  "zap": Zap,
  "package": Package,
  "download": Download,
  "book-open": BookOpen,
  "receipt": Receipt,
  "briefcase-business": BriefcaseBusiness,
  "bot": Bot,
  "cpu": Cpu,
  "paintbrush": Paintbrush,
  "building-2": Building2,
  "wrench": Wrench,
};

/**
 * Resuelve un iconKey a su componente lucide-react.
 * Fallback a Wrench si no se encuentra.
 */
export function resolveIcon(iconKey: string): LucideIcon {
  return ICON_MAP[iconKey] || Wrench;
}
