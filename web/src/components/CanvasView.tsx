import { CircleDot, MousePointer2, Square } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { controlRect, normalizeRect, resizeHandles } from "../geometry";
import type { Rect, ResizeHandle } from "../geometry";
import type { Editor, SelectionMode } from "../editorTypes";
import type { ControlKind } from "../layout";

type DragMode =
  | { readonly kind: "move"; readonly pointerId: number; readonly startX: number; readonly startY: number }
  | { readonly kind: "resize"; readonly pointerId: number; readonly handle: ResizeHandle; readonly startX: number; readonly startY: number }
  | { readonly kind: "marquee"; readonly pointerId: number; readonly startX: number; readonly startY: number; readonly currentX: number; readonly currentY: number; readonly mode: SelectionMode };

export function CanvasView(props: { readonly editor: Editor }) {
  const [drag, setDrag] = createSignal<DragMode | null>(null);
  const marquee = () => {
    const state = drag();
    return state?.kind === "marquee" ? normalizeRect(state.startX, state.startY, state.currentX, state.currentY) : undefined;
  };

  function pointerPosition(event: PointerEvent): { readonly x: number; readonly y: number } {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return { x: 0, y: 0 };
    }
    const rect = target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginCanvas(event: PointerEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      target.setPointerCapture(event.pointerId);
    }
    const point = pointerPosition(event);
    const mode = event.metaKey || event.ctrlKey || event.shiftKey ? "add" : "replace";
    if (mode === "replace") {
      props.editor.deselect();
    }
    setDrag({ kind: "marquee", pointerId: event.pointerId, startX: point.x, startY: point.y, currentX: point.x, currentY: point.y, mode });
  }

  function beginMove(index: number, event: PointerEvent): void {
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      target.setPointerCapture(event.pointerId);
    }
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    const selected = props.editor.selectedIndices().includes(index);
    if (additive) {
      props.editor.selectControl(index, "toggle");
    } else if (!selected) {
      props.editor.selectControl(index, "replace");
    }
    setDrag({ kind: "move", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY });
  }

  function beginResize(handle: ResizeHandle, event: PointerEvent): void {
    event.stopPropagation();
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      target.setPointerCapture(event.pointerId);
    }
    setDrag({ kind: "resize", pointerId: event.pointerId, handle, startX: event.clientX, startY: event.clientY });
  }

  function move(event: PointerEvent): void {
    const state = drag();
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    if (state.kind === "marquee") {
      const point = pointerPosition(event);
      setDrag({ ...state, currentX: point.x, currentY: point.y });
      return;
    }
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (state.kind === "resize") {
      props.editor.resizePrimary(state.handle, deltaX, deltaY);
    } else {
      props.editor.moveSelection(deltaX, deltaY);
    }
    setDrag({ ...state, startX: event.clientX, startY: event.clientY });
  }

  function end(event: PointerEvent): void {
    const state = drag();
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    if (state.kind === "marquee") {
      const rect = normalizeRect(state.startX, state.startY, state.currentX, state.currentY);
      if (rect.width > 3 || rect.height > 3) {
        props.editor.selectWithinRect(rect, state.mode);
      }
    }
    setDrag(null);
  }

  return (
    <div class="h-[calc(100vh-56px)] overflow-auto p-3 max-[1020px]:h-auto">
      <div
        class="relative border border-line bg-[#0b0e13] shadow-2xl shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
        role="application"
        aria-label="RemotePad layout canvas"
        tabindex="0"
        style={{ width: props.editor.layout().canvasSize.width, height: props.editor.layout().canvasSize.height, "touch-action": "none" }}
        onPointerDown={beginCanvas}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <For each={props.editor.layout().controls}>
          {(control, index) => (
            <button
              type="button"
              class={controlClass(control.type, props.editor.selectedIndices().includes(index()), props.editor.primaryIndex() === index())}
              style={{
                left: control.left,
                top: control.top,
                width: control.width,
                height: control.height,
                "border-radius": control.borderRadius,
                transform: control.transform || undefined,
                "touch-action": "none"
              }}
              aria-label={`${control.type} ${index() + 1} ${control.key || ""}`}
              aria-pressed={props.editor.selectedIndices().includes(index())}
              onPointerDown={(event) => beginMove(index(), event)}
            >
              <ControlGlyph type={control.type} />
              <span class="max-w-full truncate px-1 text-[11px] font-semibold">{control.key || control.type}</span>
            </button>
          )}
        </For>

        <Show when={primaryOverlay(props.editor)}>
          {(rect) => (
            <For each={resizeHandles}>
              {(handle) => <ResizeHandleButton rect={rect()} handle={handle} onPointerDown={(event) => beginResize(handle, event)} />}
            </For>
          )}
        </Show>

        <Show when={marquee()}>
          {(rect) => <div class="pointer-events-none absolute border border-action bg-action/15" style={rectStyle(rect())} />}
        </Show>
      </div>
    </div>
  );
}

function primaryOverlay(editor: Editor): Rect | undefined {
  const control = editor.primaryControl();
  return control ? controlRect(control) : undefined;
}

function ResizeHandleButton(props: {
  readonly rect: Rect;
  readonly handle: ResizeHandle;
  readonly onPointerDown: (event: PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      class="absolute z-20 h-3 w-3 rounded-sm border border-white bg-action shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={handleStyle(props.rect, props.handle)}
      aria-label={`Resize ${props.handle}`}
      onPointerDown={props.onPointerDown}
    />
  );
}

function ControlGlyph(props: { readonly type: ControlKind }) {
  if (props.type === "Joystick") {
    return <CircleDot class="h-5 w-5 shrink-0" />;
  }
  if (props.type === "MouseZone") {
    return <MousePointer2 class="h-5 w-5 shrink-0" />;
  }
  return <Square class="h-5 w-5 shrink-0" />;
}

function controlClass(type: ControlKind, selected: boolean, primary: boolean): string {
  const base = "absolute flex select-none flex-col items-center justify-center gap-1 overflow-hidden border text-center text-xs shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white";
  const color = type === "Button" ? "border-action/80 bg-action/15 text-[#d8e9ff]" : type === "Joystick" ? "border-ok/75 bg-ok/15 text-[#d9ffe5]" : "border-[#f59e0b]/75 bg-[#f59e0b]/15 text-[#fff0cf]";
  const ring = primary ? "outline outline-2 outline-offset-2 outline-white" : selected ? "outline outline-2 outline-offset-2 outline-action" : "";
  return `${base} ${color} ${ring}`;
}

function handleStyle(rect: Rect, handle: ResizeHandle): Record<string, string> {
  const x = handle.includes("w") ? rect.left : handle.includes("e") ? rect.left + rect.width : rect.left + rect.width / 2;
  const y = handle.includes("n") ? rect.top : handle.includes("s") ? rect.top + rect.height : rect.top + rect.height / 2;
  return { left: `${x - 6}px`, top: `${y - 6}px`, cursor: cursorForHandle(handle), "touch-action": "none" };
}

function rectStyle(rect: Rect): Record<string, string> {
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` };
}

function cursorForHandle(handle: ResizeHandle): string {
  if (handle === "n" || handle === "s") {
    return "ns-resize";
  }
  if (handle === "e" || handle === "w") {
    return "ew-resize";
  }
  if (handle === "nw" || handle === "se") {
    return "nwse-resize";
  }
  return "nesw-resize";
}
