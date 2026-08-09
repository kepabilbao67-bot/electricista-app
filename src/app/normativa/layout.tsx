import { guardModule } from "@/lib/core/module-guard";

export default function NormativaLayout({ children }: { children: React.ReactNode }) {
  guardModule("normativa");
  return <>{children}</>;
}
