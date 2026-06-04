import { parseLayout, serializeLayout } from "./layout";
import type { Layout } from "./layout";
import type { Status } from "./editorTypes";

export function exportLayoutFile(layout: Layout): void {
  const blob = new Blob([serializeLayout(layout)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "remotepad-layout.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importLayoutFile(
  event: Event,
  resetLayout: (layout: Layout, status: Status) => void,
  setStatus: (status: Status) => void
): Promise<void> {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  try {
    const payload: unknown = JSON.parse(await file.text());
    resetLayout(parseLayout(payload), { kind: "ok", text: "Imported" });
  } catch (error) {
    if (error instanceof Error) {
      setStatus({ kind: "error", text: "Invalid JSON" });
      return;
    }
    throw error;
  }
}
