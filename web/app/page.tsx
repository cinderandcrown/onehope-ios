import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function IndexPage() {
  const jar = await cookies();
  redirect(jar.get("onehope_session") ? "/overview" : "/login");
}
