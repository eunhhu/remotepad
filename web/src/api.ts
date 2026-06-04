import { parseLayout, serializeLayout, type Layout } from "./layout";

const layoutName = "default";

export async function fetchLayout(): Promise<Layout> {
  const response = await fetch(`/api/layouts/${layoutName}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const payload: unknown = await response.json();
  return parseLayout(payload);
}

export async function persistLayout(layout: Layout): Promise<void> {
  const response = await fetch(`/api/layouts/${layoutName}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: serializeLayout(layout)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
