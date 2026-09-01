import { loadVerticalConfig } from "../core/vertical-loader";
import { ChatError } from "./chats";

export function assertChatAccess(url: URL, origin?: string | null) {
  const config=loadVerticalConfig();
  if (config.id !== "barymont" || !config.modules.includes("chats")) throw new ChatError("No encontrado",404);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new ChatError("Solo disponible en entorno local",403);
  if (origin && origin !== url.origin) throw new ChatError("Origen no permitido",403);
  const database=process.env.TURSO_DATABASE_URL || "";
  if (process.env.CHAT_DEMO_MODE !== "true" || process.env.DEMO_MODE === "true" || !/^file:.*barymont-chats-demo\.db$/.test(database) || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new ChatError("Configura CHAT_DEMO_MODE=true y una base local dedicada barymont-chats-demo.db. DEMO_MODE debe permanecer desactivado.",403);
  }
}
