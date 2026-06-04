import {
  ArrowDownToLine,
  CircleDot,
  Gamepad2,
  Grid3X3,
  Joystick,
  MousePointer2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Upload
} from "lucide-solid";
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { fetchLayout, persistLayout } from "./api";
import {
  clamp,
  cloneLayout,
  controlKinds,
  createControl,
  defaultLayout,
  parseLayout,
  readPixels,
  serializeLayout,
  toPixels,
  type ControlKind,
  type Layout,
  type LayoutControl
} from "./layout";

type StatusKind = "idle" | "saving" | "ok" | "error";

type Status = {
  kind: StatusKind;
  text: string;
};

type DragState = {
  index: number;
  pointerId: number;
  originX: number;
  originY: number;
  startLeft: number;
  startTop: number;
};

type NumericField = "left" | "top" | "width" | "height" | "borderRadius";

const minSize = 24;

export default function App() {
  const [layout, setLayout] = createSignal<Layout>(cloneLayout(defaultLayout));
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [status, setStatus] = createSignal<Status>({
    kind: "idle",
    text: "Local"
  });
  const [dragState, setDragState] = createSignal<DragState | null>(null);

  const selectedControl = createMemo<LayoutControl | undefined>(() => {
    const index = selectedIndex();
    return index >= 0 ? layout().controls[index] : undefined;
  });

  const canvasWidth = createMemo(() => readPixels(layout().canvasSize.width, 820));
  const canvasHeight = createMemo(() => readPixels(layout().canvasSize.height, 420));

  onMount(() => {
    void loadRemote();
  });

  async function loadRemote(): Promise<void> {
    setStatus({ kind: "saving", text: "Loading" });
    try {
      const remoteLayout = await fetchLayout();
      setLayout(cloneLayout(remoteLayout));
      setSelectedIndex(remoteLayout.controls.length > 0 ? 0 : -1);
      setStatus({ kind: "ok", text: "Loaded" });
    } catch {
      setLayout(cloneLayout(defaultLayout));
      setSelectedIndex(defaultLayout.controls.length > 0 ? 0 : -1);
      setStatus({ kind: "idle", text: "Default" });
    }
  }

  async function saveRemote(): Promise<void> {
    setStatus({ kind: "saving", text: "Saving" });
    try {
      await persistLayout(layout());
      setStatus({ kind: "ok", text: "Saved" });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Save failed"
      });
    }
  }

  function updateCanvas(field: "width" | "height", value: string): void {
    const parsed = clamp(Number.parseInt(value, 10), 280, 2400);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setLayout((previous) => ({
      ...previous,
      canvasSize: {
        ...previous.canvasSize,
        [field]: toPixels(parsed)
      }
    }));
  }

  function updateControl(index: number, patch: Partial<LayoutControl>): void {
    setLayout((previous) => ({
      ...previous,
      controls: previous.controls.map((control, controlIndex) =>
        controlIndex === index ? { ...control, ...patch } : control
      )
    }));
  }

  function updateSelected(patch: Partial<LayoutControl>): void {
    const index = selectedIndex();
    if (index < 0) {
      return;
    }
    updateControl(index, patch);
  }

  function updateNumeric(field: NumericField, value: string): void {
    const control = selectedControl();
    if (!control) {
      return;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const maxX = Math.max(0, canvasWidth() - readPixels(control.width, minSize));
    const maxY = Math.max(0, canvasHeight() - readPixels(control.height, minSize));
    const maxByField: Record<NumericField, number> = {
      left: maxX,
      top: maxY,
      width: canvasWidth(),
      height: canvasHeight(),
      borderRadius: 999
    };
    const minByField: Record<NumericField, number> = {
      left: 0,
      top: 0,
      width: minSize,
      height: minSize,
      borderRadius: 0
    };
    updateSelected({
      [field]: toPixels(clamp(parsed, minByField[field], maxByField[field]))
    });
  }

  function addControl(type: ControlKind): void {
    setLayout((previous) => {
      const next = createControl(type, previous.controls.length);
      setSelectedIndex(previous.controls.length);
      return {
        ...previous,
        controls: [...previous.controls, next]
      };
    });
  }

  function deleteSelected(): void {
    const index = selectedIndex();
    if (index < 0) {
      return;
    }
    setLayout((previous) => ({
      ...previous,
      controls: previous.controls.filter((_, controlIndex) => controlIndex !== index)
    }));
    setSelectedIndex(Math.max(0, index - 1));
  }

  function beginDrag(index: number, event: PointerEvent): void {
    const control = layout().controls[index];
    if (!control) {
      return;
    }
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    target.setPointerCapture(event.pointerId);
    setSelectedIndex(index);
    setDragState({
      index,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startLeft: readPixels(control.left, 0),
      startTop: readPixels(control.top, 0)
    });
  }

  function moveDrag(event: PointerEvent): void {
    const state = dragState();
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    const control = layout().controls[state.index];
    if (!control) {
      return;
    }
    const nextLeft = state.startLeft + event.clientX - state.originX;
    const nextTop = state.startTop + event.clientY - state.originY;
    const maxLeft = Math.max(0, canvasWidth() - readPixels(control.width, minSize));
    const maxTop = Math.max(0, canvasHeight() - readPixels(control.height, minSize));
    updateControl(state.index, {
      left: toPixels(clamp(nextLeft, 0, maxLeft)),
      top: toPixels(clamp(nextTop, 0, maxTop))
    });
  }

  function endDrag(event: PointerEvent): void {
    const state = dragState();
    if (state && state.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  function exportLayout(): void {
    const blob = new Blob([serializeLayout(layout())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "remotepad-layout.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importLayout(event: Event): Promise<void> {
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
      const content = await file.text();
      const payload: unknown = JSON.parse(content);
      const imported = parseLayout(payload);
      setLayout(cloneLayout(imported));
      setSelectedIndex(imported.controls.length > 0 ? 0 : -1);
      setStatus({ kind: "ok", text: "Imported" });
    } catch {
      setStatus({ kind: "error", text: "Invalid JSON" });
    }
  }

  return (
    <main class="min-h-screen bg-[#101318] text-ink">
      <div class="grid min-h-screen grid-cols-[64px_minmax(0,1fr)_280px] max-[980px]:grid-cols-1">
        <aside class="flex flex-col items-center gap-2 border-r border-line bg-panel px-2 py-4 max-[980px]:flex-row max-[980px]:border-b max-[980px]:border-r-0">
          <Gamepad2 class="mb-4 h-8 w-8 text-action max-[980px]:mb-0" />
          <ToolButton label="Add button" onClick={() => addControl("Button")}>
            <Square class="h-5 w-5" />
          </ToolButton>
          <ToolButton label="Add joystick" onClick={() => addControl("Joystick")}>
            <Joystick class="h-5 w-5" />
          </ToolButton>
          <ToolButton label="Add mouse zone" onClick={() => addControl("MouseZone")}>
            <MousePointer2 class="h-5 w-5" />
          </ToolButton>
          <div class="h-px w-10 bg-line max-[980px]:h-10 max-[980px]:w-px" />
          <ToolButton label="Load" onClick={() => void loadRemote()}>
            <RotateCcw class="h-5 w-5" />
          </ToolButton>
          <ToolButton label="Save" onClick={() => void saveRemote()}>
            <Save class="h-5 w-5" />
          </ToolButton>
          <ToolButton label="Export JSON" onClick={exportLayout}>
            <ArrowDownToLine class="h-5 w-5" />
          </ToolButton>
          <label
            class="grid h-10 w-10 cursor-pointer place-items-center rounded-md border border-line bg-[#1d232c] text-muted hover:border-action hover:text-ink"
            title="Import JSON"
          >
            <Upload class="h-5 w-5" />
            <input class="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importLayout(event)} />
          </label>
        </aside>

        <section class="min-w-0 bg-[#12161d]">
          <div class="flex h-14 items-center justify-between border-b border-line px-5">
            <div class="flex items-center gap-3">
              <Grid3X3 class="h-5 w-5 text-muted" />
              <span class="text-sm font-semibold">RemotePad</span>
              <span class={statusClass(status().kind)}>{status().text}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-muted">
              <span>{layout().controls.length} controls</span>
              <span>
                {canvasWidth()} x {canvasHeight()}
              </span>
            </div>
          </div>

          <div class="h-[calc(100vh-56px)] overflow-auto p-3 max-[980px]:h-auto">
            <div
              class="relative border border-line bg-[#0b0e13] shadow-2xl shadow-black/30"
              style={{
                width: layout().canvasSize.width,
                height: layout().canvasSize.height,
                "touch-action": "none"
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <For each={layout().controls}>
                {(control, index) => (
                  <button
                    type="button"
                    class={controlClass(control.type, selectedIndex() === index())}
                    style={{
                      left: control.left,
                      top: control.top,
                      width: control.width,
                      height: control.height,
                      "border-radius": control.borderRadius,
                      transform: control.transform || undefined,
                      "touch-action": "none"
                    }}
                    onPointerDown={(event) => beginDrag(index(), event)}
                  >
                    <ControlGlyph type={control.type} />
                    <span class="max-w-full truncate px-1 text-[11px] font-semibold">{control.key || control.type}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </section>

        <aside class="border-l border-line bg-panel max-[980px]:border-l-0 max-[980px]:border-t">
          <div class="flex h-14 items-center justify-between border-b border-line px-4">
            <span class="text-sm font-semibold">Inspector</span>
            <button
              type="button"
              class="grid h-9 w-9 place-items-center rounded-md border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-35"
              title="Delete"
              disabled={!selectedControl()}
              onClick={deleteSelected}
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-4 p-4">
            <Field label="Canvas W">
              <NumberInput value={canvasWidth()} onInput={(value) => updateCanvas("width", value)} />
            </Field>
            <Field label="Canvas H">
              <NumberInput value={canvasHeight()} onInput={(value) => updateCanvas("height", value)} />
            </Field>

            <div class="h-px bg-line" />

            <Show when={selectedControl()} fallback={<p class="text-sm text-muted">No selection</p>}>
              {(control) => (
                <div class="space-y-4">
                  <Field label="Type">
                    <select
                      class="input"
                      value={control().type}
                      onInput={(event) => {
                        const nextType = parseControlKind(event.currentTarget.value);
                        if (nextType) {
                          updateSelected({ type: nextType });
                        }
                      }}
                    >
                      <For each={controlKinds}>{(kind) => <option value={kind}>{kind}</option>}</For>
                    </select>
                  </Field>

                  <Field label="Key">
                    <input
                      class="input"
                      value={control().key}
                      spellcheck={false}
                      onInput={(event) => updateSelected({ key: event.currentTarget.value })}
                    />
                  </Field>

                  <div class="grid grid-cols-2 gap-3">
                    <Field label="X">
                      <NumberInput value={readPixels(control().left, 0)} onInput={(value) => updateNumeric("left", value)} />
                    </Field>
                    <Field label="Y">
                      <NumberInput value={readPixels(control().top, 0)} onInput={(value) => updateNumeric("top", value)} />
                    </Field>
                    <Field label="W">
                      <NumberInput value={readPixels(control().width, minSize)} onInput={(value) => updateNumeric("width", value)} />
                    </Field>
                    <Field label="H">
                      <NumberInput value={readPixels(control().height, minSize)} onInput={(value) => updateNumeric("height", value)} />
                    </Field>
                  </div>

                  <Field label="Radius">
                    <NumberInput value={readPixels(control().borderRadius, 0)} onInput={(value) => updateNumeric("borderRadius", value)} />
                  </Field>
                </div>
              )}
            </Show>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ToolButton(props: {
  label: string;
  onClick: () => void;
  children: import("solid-js").JSX.Element;
}) {
  return (
    <button
      type="button"
      class="grid h-10 w-10 place-items-center rounded-md border border-line bg-[#1d232c] text-muted hover:border-action hover:text-ink"
      title={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function Field(props: { label: string; children: import("solid-js").JSX.Element }) {
  return (
    <label class="block space-y-1.5">
      <span class="text-xs font-medium uppercase text-muted">{props.label}</span>
      {props.children}
    </label>
  );
}

function NumberInput(props: { value: number; onInput: (value: string) => void }) {
  return (
    <input
      class="input"
      type="number"
      inputmode="numeric"
      value={props.value}
      onInput={(event) => props.onInput(event.currentTarget.value)}
    />
  );
}

function ControlGlyph(props: { type: ControlKind }) {
  if (props.type === "Joystick") {
    return <CircleDot class="h-5 w-5 shrink-0" />;
  }
  if (props.type === "MouseZone") {
    return <MousePointer2 class="h-5 w-5 shrink-0" />;
  }
  return <Square class="h-5 w-5 shrink-0" />;
}

function controlClass(type: ControlKind, selected: boolean): string {
  const base =
    "absolute flex select-none flex-col items-center justify-center gap-1 overflow-hidden border text-center text-xs shadow-lg";
  const color =
    type === "Button"
      ? "border-action/80 bg-action/15 text-[#d8e9ff]"
      : type === "Joystick"
        ? "border-ok/75 bg-ok/15 text-[#d9ffe5]"
        : "border-[#f59e0b]/75 bg-[#f59e0b]/15 text-[#fff0cf]";
  const ring = selected ? "outline outline-2 outline-offset-2 outline-white" : "";
  return `${base} ${color} ${ring}`;
}

function parseControlKind(value: string): ControlKind | undefined {
  return controlKinds.find((kind) => kind === value);
}

function statusClass(kind: StatusKind): string {
  const base = "rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (kind === "ok") {
    return `${base} border-ok/40 bg-ok/10 text-ok`;
  }
  if (kind === "error") {
    return `${base} border-danger/40 bg-danger/10 text-danger`;
  }
  if (kind === "saving") {
    return `${base} border-action/40 bg-action/10 text-action`;
  }
  return `${base} border-line bg-[#1d232c] text-muted`;
}
