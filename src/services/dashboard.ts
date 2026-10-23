import { connection } from "next/server";
import { store } from "@/lib/store";
import type { FindingStatus, Severity } from "@/lib/types";

export type GateState = "OPEN" | "HELD" | "UNKNOWN";

export async function getOverview() {
  await connection();
  return store.getOverview();
}

export const listRepositories = async () => {
  await connection();
  return store.listRepositories();
};

export const listRuns = async () => {
  await connection();
  return store.listRuns();
};

export const listFindings = async (f: { severity?: Severity; status?: FindingStatus }) => {
  await connection();
  return store.listFindings(f);
};

export const listNotifications = async () => {
  await connection();
  return store.listNotifications();
};

export const listDeployments = async () => {
  await connection();
  return store.listDeployments();
};

export const listAudit = async () => {
  await connection();
  return store.listAudit();
};
