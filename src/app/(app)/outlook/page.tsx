import { redirect } from "next/navigation";
import { CALENDARIO_PATH } from "@/lib/calendario";

export default function OutlookRedirectPage() {
  redirect(CALENDARIO_PATH);
}
