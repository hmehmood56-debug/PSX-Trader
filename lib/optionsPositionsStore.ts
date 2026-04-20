import type { OptionsPositionsFile, SimulatedOptionPosition } from "@/lib/optionsTypes";

const STORAGE_KEY = "psx_options_positions_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emptyFile(): OptionsPositionsFile {
  return { version: 1, positions: [] };
}

function readFile(): OptionsPositionsFile {
  if (!isBrowser()) return emptyFile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFile();
    const parsed = JSON.parse(raw) as OptionsPositionsFile;
    if (parsed?.version !== 1 || !Array.isArray(parsed.positions)) return emptyFile();
    return parsed;
  } catch {
    return emptyFile();
  }
}

function writeFile(file: OptionsPositionsFile): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

const POSITIONS_EVENT = "psx-options-positions-updated";

function notifyPositionsChanged(): void {
  if (isBrowser()) {
    window.dispatchEvent(new Event(POSITIONS_EVENT));
  }
}

export function subscribeOptionsPositions(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(POSITIONS_EVENT, listener);
  return () => window.removeEventListener(POSITIONS_EVENT, listener);
}

export function listOptionsPositions(ownerKey: string): SimulatedOptionPosition[] {
  const file = readFile();
  return file.positions
    .filter((p) => p.ownerKey === ownerKey)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function appendOptionsPosition(
  ownerKey: string,
  input: Omit<SimulatedOptionPosition, "id" | "ownerKey" | "createdAt">
): SimulatedOptionPosition {
  const file = readFile();
  const row: SimulatedOptionPosition = {
    ...input,
    id: crypto.randomUUID(),
    ownerKey,
    createdAt: new Date().toISOString(),
  };
  file.positions = [row, ...file.positions].slice(0, 500);
  writeFile(file);
  notifyPositionsChanged();
  return row;
}
