import { guardModule } from "@/lib/core/module-guard";

export default function PartesTrabajoLayout({ children }: { children: React.ReactNode }) {
  guardModule("work_orders");
  return <>{children}</>;
}
