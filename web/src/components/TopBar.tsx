import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  Copy,
  Grid3X3
} from "lucide-solid";
import type { Editor } from "../editorTypes";
import { IconButton } from "./IconButton";

export function TopBar(props: { readonly editor: Editor }) {
  const hasSelection = () => props.editor.selectedIndices().length > 0;
  const canDistribute = () => props.editor.selectedIndices().length > 2;
  return (
    <div class="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 min-[1021px]:h-14 min-[1021px]:flex-nowrap min-[1021px]:py-0">
      <div class="flex min-w-0 items-center gap-3">
        <Grid3X3 class="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        <span class="text-sm font-semibold">RemotePad</span>
        <span class={statusClass(props.editor.status().kind)} aria-live="polite">
          {props.editor.status().text}
        </span>
      </div>
      <div class="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 min-[1021px]:order-none min-[1021px]:w-auto min-[1021px]:overflow-visible min-[1021px]:pb-0">
        <IconButton label="Duplicate" shortcut="Control+D" disabled={!hasSelection()} onClick={props.editor.duplicateSelection}>
          <Copy class="h-4 w-4" />
        </IconButton>
        <IconButton label="Align left" disabled={!hasSelection()} onClick={() => props.editor.alignSelection("left")}>
          <AlignStartVertical class="h-4 w-4" />
        </IconButton>
        <IconButton label="Align center X" disabled={!hasSelection()} onClick={() => props.editor.alignSelection("center-x")}>
          <AlignCenterVertical class="h-4 w-4" />
        </IconButton>
        <IconButton label="Align right" disabled={!hasSelection()} onClick={() => props.editor.alignSelection("right")}>
          <AlignEndVertical class="h-4 w-4" />
        </IconButton>
        <IconButton label="Align top" disabled={!hasSelection()} onClick={() => props.editor.alignSelection("top")}>
          <AlignStartHorizontal class="h-4 w-4" />
        </IconButton>
        <IconButton label="Align middle Y" disabled={!hasSelection()} onClick={() => props.editor.alignSelection("center-y")}>
          <AlignCenterHorizontal class="h-4 w-4" />
        </IconButton>
        <IconButton label="Align bottom" disabled={!hasSelection()} onClick={() => props.editor.alignSelection("bottom")}>
          <AlignEndHorizontal class="h-4 w-4" />
        </IconButton>
        <IconButton label="Distribute X" disabled={!canDistribute()} onClick={() => props.editor.distributeSelection("x")}>
          <AlignHorizontalSpaceBetween class="h-4 w-4" />
        </IconButton>
        <IconButton label="Distribute Y" disabled={!canDistribute()} onClick={() => props.editor.distributeSelection("y")}>
          <AlignVerticalSpaceBetween class="h-4 w-4" />
        </IconButton>
      </div>
      <div class="hidden items-center gap-3 text-xs text-muted min-[1260px]:flex">
        <span>{props.editor.selectedIndices().length} selected</span>
        <span>{props.editor.layout().controls.length} controls</span>
        <span>
          {props.editor.canvasWidth()} x {props.editor.canvasHeight()}
        </span>
      </div>
    </div>
  );
}

function statusClass(kind: Editor["status"] extends () => infer Status ? Status extends { readonly kind: infer Kind } ? Kind : never : never): string {
  const base = "rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (kind === "ok") {
    return `${base} border-ok/40 bg-ok/10 text-ok`;
  }
  if (kind === "error") {
    return `${base} border-danger/40 bg-danger/10 text-danger`;
  }
  if (kind === "saving" || kind === "recording") {
    return `${base} border-action/40 bg-action/10 text-action`;
  }
  return `${base} border-line bg-[#1d232c] text-muted`;
}
