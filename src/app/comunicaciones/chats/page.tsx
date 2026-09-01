import { notFound } from "next/navigation";
import { loadVerticalConfig } from "@/lib/core/vertical-loader";
import { guardModule } from "@/lib/core/module-guard";
import ChatInbox from "@/components/communications/ChatInbox";
export const dynamic="force-dynamic";
export default function ChatsPage() {
  guardModule("chats");
  if(loadVerticalConfig().id!=="barymont") notFound();
  return <ChatInbox/>;
}
