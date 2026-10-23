import { connection } from "next/server";
import { store } from "@/lib/store";

// Used by deployment health checks. Reports status only, no internals.
export async function GET() {
  await connection(); // always evaluate at request time, never at build time
  return Response.json({ status: "ok", mode: "in-memory", repositories: store.repositories.length });
}
