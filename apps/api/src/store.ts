import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BankConnection } from "@finly/shared";

const dataDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "../data");
const filePath = path.join(dataDir, "connection.json");

export async function loadConnection(): Promise<BankConnection | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as BankConnection;
  } catch {
    return null;
  }
}

export async function saveConnection(connection: BankConnection): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(connection, null, 2), "utf8");
}

export async function clearConnection(): Promise<void> {
  await writeFile(filePath, "null", "utf8").catch(() => undefined);
}
