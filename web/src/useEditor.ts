import { createMemo, createSignal } from "solid-js";
import { fetchLayout, persistLayout } from "./api";
import { exportLayoutFile, importLayoutFile } from "./browserLayoutFiles";
import {
  alignControls,
  distributeControls,
  layoutCanvasRect,
  minControlSize,
  moveControls,
  normalizeSelection,
  patchControl,
  rectIntersects,
  resizeControl
} from "./geometry";
import type { AlignmentAction, DistributionAxis, NumericField, Rect } from "./geometry";
import { cloneLayout, controlKinds, createControl, defaultLayout, readPixels, toPixels } from "./layout";
import type { ControlKind, Layout, LayoutControl } from "./layout";
import type { Editor, SelectionMode, Status } from "./editorTypes";
import { handleEditorKeyDown } from "./shortcuts";

export function useEditor(): Editor {
  const [layout, setLayout] = createSignal<Layout>(cloneLayout(defaultLayout));
  const [selectedIndices, setSelectedIndices] = createSignal<readonly number[]>([0]);
  const [status, setStatus] = createSignal<Status>({ kind: "idle", text: "Local" });
  const [recording, setRecording] = createSignal(false);

  const primaryIndex = createMemo(() => selectedIndices().at(-1));
  const primaryControl = createMemo(() => {
    const index = primaryIndex();
    return index === undefined ? undefined : layout().controls[index];
  });
  const selectedControls = createMemo(() => selectedIndices().flatMap((index) => layout().controls[index] ?? []));
  const canvasWidth = createMemo(() => layoutCanvasRect(layout()).width);
  const canvasHeight = createMemo(() => layoutCanvasRect(layout()).height);

  async function loadRemote(): Promise<void> {
    setStatus({ kind: "saving", text: "Loading" });
    try {
      const remoteLayout = await fetchLayout();
      resetLayout(remoteLayout, { kind: "ok", text: "Loaded" });
    } catch (error) {
      if (error instanceof Error) {
        resetLayout(defaultLayout, { kind: "idle", text: "Default" });
        return;
      }
      throw error;
    }
  }

  async function saveRemote(): Promise<void> {
    setStatus({ kind: "saving", text: "Saving" });
    try {
      await persistLayout(layout());
      setStatus({ kind: "ok", text: "Saved" });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Save failed" });
    }
  }

  function resetLayout(nextLayout: Layout, nextStatus: Status): void {
    const cloned = cloneLayout(nextLayout);
    setLayout(cloned);
    setSelectedIndices(cloned.controls.length > 0 ? [0] : []);
    setRecording(false);
    setStatus(nextStatus);
  }

  function addControl(type: ControlKind): void {
    setLayout((previous) => {
      const next = createControl(type, previous.controls.length);
      setSelectedIndices([previous.controls.length]);
      return { ...previous, controls: [...previous.controls, next] };
    });
  }

  function deleteSelection(): void {
    const selected = new Set(selectedIndices());
    if (selected.size === 0) {
      return;
    }
    setLayout((previous) => ({ ...previous, controls: previous.controls.filter((_, index) => !selected.has(index)) }));
    setSelectedIndices([]);
    setRecording(false);
  }

  function duplicateSelection(): void {
    const selected = selectedControls().map((control) => ({ ...control, left: toPixels(readPixels(control.left, 0) + 16), top: toPixels(readPixels(control.top, 0) + 16) }));
    if (selected.length === 0) {
      return;
    }
    setLayout((previous) => {
      const start = previous.controls.length;
      setSelectedIndices(selected.map((_, index) => start + index));
      return { ...previous, controls: [...previous.controls, ...selected] };
    });
  }

  function selectControl(index: number, mode: SelectionMode): void {
    setSelectedIndices((previous) => {
      const count = layout().controls.length;
      const exists = previous.includes(index);
      if (mode === "replace") {
        return normalizeSelection([index], count);
      }
      if (mode === "add") {
        return normalizeSelection([...previous, index], count);
      }
      return normalizeSelection(exists ? previous.filter((item) => item !== index) : [...previous, index], count);
    });
  }

  function selectWithinRect(rect: Rect, mode: SelectionMode): void {
    const hits = layout().controls.flatMap((control, index) => rectIntersects(rect, {
      left: readPixels(control.left, 0),
      top: readPixels(control.top, 0),
      width: readPixels(control.width, minControlSize),
      height: readPixels(control.height, minControlSize)
    }) ? [index] : []);
    setSelectedIndices((previous) => normalizeSelection(mode === "add" ? [...previous, ...hits] : hits, layout().controls.length));
  }

  function updateCanvas(field: "width" | "height", value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setLayout((previous) => ({
      ...previous,
      canvasSize: { ...previous.canvasSize, [field]: toPixels(limitCanvasDimension(parsed)) }
    }));
  }

  function updateCanvasSize(width: number, height: number): void {
    setLayout((previous) => ({
      ...previous,
      canvasSize: {
        width: toPixels(limitCanvasDimension(width)),
        height: toPixels(limitCanvasDimension(height))
      }
    }));
  }

  function updatePrimary(patch: Partial<LayoutControl>): void {
    const index = primaryIndex();
    if (index !== undefined) {
      setLayout((previous) => patchControl(previous, index, patch));
    }
  }

  function updatePrimaryNumeric(field: NumericField, value: string): void {
    const control = primaryControl();
    const parsed = Number.parseInt(value, 10);
    if (!control || !Number.isFinite(parsed)) {
      return;
    }
    const patch = numericPatch(field, parsed, control, canvasWidth(), canvasHeight());
    updatePrimary(patch);
  }

  function bindKeyToPrimary(code: string): void {
    if (code.length === 0) {
      return;
    }
    updatePrimary({ key: code });
    setRecording(false);
    setStatus({ kind: "ok", text: code });
  }

  return {
    layout,
    selectedIndices,
    selectedControls,
    primaryIndex,
    primaryControl,
    status,
    recording,
    canvasWidth,
    canvasHeight,
    setStatus,
    loadRemote,
    saveRemote,
    exportLayout: () => exportLayoutFile(layout()),
    importLayout: (event) => importLayoutFile(event, resetLayout, setStatus),
    addButton: () => addControl("Button"),
    addJoystick: () => addControl("Joystick"),
    addMouseZone: () => addControl("MouseZone"),
    deleteSelection,
    duplicateSelection,
    selectControl,
    selectAll: () => setSelectedIndices(layout().controls.map((_, index) => index)),
    deselect: () => {
      setSelectedIndices([]);
      setRecording(false);
    },
    selectWithinRect,
    moveSelection: (deltaX, deltaY) => setLayout((previous) => moveControls(previous, selectedIndices(), deltaX, deltaY)),
    resizePrimary: (handle, deltaX, deltaY) => {
      const index = primaryIndex();
      if (index !== undefined) {
        setLayout((previous) => resizeControl(previous, index, handle, deltaX, deltaY));
      }
    },
    alignSelection: (action: AlignmentAction) => setLayout((previous) => alignControls(previous, selectedIndices(), action)),
    distributeSelection: (axis: DistributionAxis) => setLayout((previous) => distributeControls(previous, selectedIndices(), axis)),
    updateCanvas,
    updateCanvasSize,
    updatePrimary,
    updatePrimaryNumeric,
    startKeyRecording: () => {
      if (primaryControl()) {
        setRecording(true);
        setStatus({ kind: "recording", text: "Recording" });
      }
    },
    bindKeyToPrimary,
    handleKeyDown: (event) => handleEditorKeyDown(event, {
      recording,
      bindKeyToPrimary,
      saveRemote,
      deleteSelection,
      duplicateSelection,
      selectAll: () => setSelectedIndices(layout().controls.map((_, index) => index)),
      deselect: () => setSelectedIndices([]),
      moveSelection: (x, y) => setLayout((previous) => moveControls(previous, selectedIndices(), x, y))
    })
  };
}

function numericPatch(field: NumericField, value: number, control: LayoutControl, canvasWidth: number, canvasHeight: number): Partial<LayoutControl> {
  const rectWidth = readPixels(control.width, minControlSize);
  const rectHeight = readPixels(control.height, minControlSize);
  if (field === "left") {
    return { left: toPixels(Math.max(0, Math.min(value, canvasWidth - rectWidth))) };
  }
  if (field === "top") {
    return { top: toPixels(Math.max(0, Math.min(value, canvasHeight - rectHeight))) };
  }
  if (field === "width") {
    return { width: toPixels(Math.max(minControlSize, Math.min(value, canvasWidth))) };
  }
  if (field === "height") {
    return { height: toPixels(Math.max(minControlSize, Math.min(value, canvasHeight))) };
  }
  return { borderRadius: toPixels(Math.max(0, Math.min(value, 999))) };
}

function limitCanvasDimension(value: number): number {
  return Math.max(280, Math.min(value, 2400));
}

export function parseControlKind(value: string): ControlKind | undefined {
  return controlKinds.find((kind) => kind === value);
}
