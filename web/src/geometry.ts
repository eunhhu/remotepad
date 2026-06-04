import type { Layout, LayoutControl } from "./layout";
import { clamp, readPixels, toPixels } from "./layout";

export const minControlSize = 24;
export const resizeHandles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type ResizeHandle = (typeof resizeHandles)[number];

export const alignmentActions = ["left", "center-x", "right", "top", "center-y", "bottom"] as const;
export type AlignmentAction = (typeof alignmentActions)[number];

export const distributionAxes = ["x", "y"] as const;
export type DistributionAxis = (typeof distributionAxes)[number];

export type NumericField = "left" | "top" | "width" | "height" | "borderRadius";

export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type Bounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export function controlRect(control: LayoutControl): Rect {
  return {
    left: readPixels(control.left, 0),
    top: readPixels(control.top, 0),
    width: readPixels(control.width, minControlSize),
    height: readPixels(control.height, minControlSize)
  };
}

export function layoutCanvasRect(layout: Layout): Rect {
  return {
    left: 0,
    top: 0,
    width: readPixels(layout.canvasSize.width, 820),
    height: readPixels(layout.canvasSize.height, 420)
  };
}

export function rectIntersects(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

export function normalizeRect(startX: number, startY: number, endX: number, endY: number): Rect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  return {
    left,
    top,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

export function moveControls(layout: Layout, indices: readonly number[], deltaX: number, deltaY: number): Layout {
  const bounds = layoutCanvasRect(layout);
  return updateControls(layout, indices, (control) => {
    const rect = controlRect(control);
    return rectToControl(control, {
      ...rect,
      left: clamp(rect.left + deltaX, 0, Math.max(0, bounds.width - rect.width)),
      top: clamp(rect.top + deltaY, 0, Math.max(0, bounds.height - rect.height))
    });
  });
}

export function resizeControl(layout: Layout, index: number, handle: ResizeHandle, deltaX: number, deltaY: number): Layout {
  const control = layout.controls[index];
  if (!control) {
    return layout;
  }
  const canvas = layoutCanvasRect(layout);
  const rect = controlRect(control);
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  const nextLeft = west ? clamp(rect.left + deltaX, 0, right - minControlSize) : rect.left;
  const nextTop = north ? clamp(rect.top + deltaY, 0, bottom - minControlSize) : rect.top;
  const nextRight = east ? clamp(right + deltaX, rect.left + minControlSize, canvas.width) : right;
  const nextBottom = south ? clamp(bottom + deltaY, rect.top + minControlSize, canvas.height) : bottom;
  return replaceControl(layout, index, rectToControl(control, {
    left: nextLeft,
    top: nextTop,
    width: Math.max(minControlSize, nextRight - nextLeft),
    height: Math.max(minControlSize, nextBottom - nextTop)
  }));
}

export function alignControls(layout: Layout, indices: readonly number[], action: AlignmentAction): Layout {
  const selected = selectedRects(layout, indices);
  if (selected.length === 0) {
    return layout;
  }
  const anchor = selected.length === 1 ? rectBounds(layoutCanvasRect(layout)) : boundsFor(selected.map((item) => item.rect));
  return updateControls(layout, indices, (control) => alignControl(control, action, anchor));
}

export function distributeControls(layout: Layout, indices: readonly number[], axis: DistributionAxis): Layout {
  if (indices.length < 3) {
    return layout;
  }
  const selected = selectedRects(layout, indices).sort((a, b) => axis === "x" ? a.rect.left - b.rect.left : a.rect.top - b.rect.top);
  const first = selected[0];
  const last = selected[selected.length - 1];
  if (!first || !last) {
    return layout;
  }
  const totalSize = selected.reduce((sum, item) => sum + (axis === "x" ? item.rect.width : item.rect.height), 0);
  const start = axis === "x" ? first.rect.left : first.rect.top;
  const end = axis === "x" ? last.rect.left + last.rect.width : last.rect.top + last.rect.height;
  const gap = (end - start - totalSize) / (selected.length - 1);
  let cursor = start;
  let next = layout;
  for (const item of selected) {
    next = replaceControl(next, item.index, rectToControl(item.control, axis === "x" ? { ...item.rect, left: cursor } : { ...item.rect, top: cursor }));
    cursor += (axis === "x" ? item.rect.width : item.rect.height) + gap;
  }
  return next;
}

export function patchControl(layout: Layout, index: number, patch: Partial<LayoutControl>): Layout {
  const control = layout.controls[index];
  return control ? replaceControl(layout, index, { ...control, ...patch }) : layout;
}

export function replaceControl(layout: Layout, index: number, control: LayoutControl): Layout {
  return {
    ...layout,
    controls: layout.controls.map((item, itemIndex) => itemIndex === index ? control : item)
  };
}

export function normalizeSelection(indices: readonly number[], controlCount: number): readonly number[] {
  return Array.from(new Set(indices.filter((index) => index >= 0 && index < controlCount))).sort((a, b) => a - b);
}

function updateControls(layout: Layout, indices: readonly number[], update: (control: LayoutControl) => LayoutControl): Layout {
  const selected = new Set(indices);
  return {
    ...layout,
    controls: layout.controls.map((control, index) => selected.has(index) ? update(control) : control)
  };
}

function selectedRects(layout: Layout, indices: readonly number[]) {
  return indices.flatMap((index) => {
    const control = layout.controls[index];
    return control ? [{ index, control, rect: controlRect(control) }] : [];
  });
}

function boundsFor(rects: readonly Rect[]): Bounds {
  return rects.reduce(
    (bounds, rect) => ({
      minX: Math.min(bounds.minX, rect.left),
      minY: Math.min(bounds.minY, rect.top),
      maxX: Math.max(bounds.maxX, rect.left + rect.width),
      maxY: Math.max(bounds.maxY, rect.top + rect.height)
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
  );
}

function rectBounds(rect: Rect): Bounds {
  return {
    minX: rect.left,
    minY: rect.top,
    maxX: rect.left + rect.width,
    maxY: rect.top + rect.height
  };
}

function alignControl(control: LayoutControl, action: AlignmentAction, anchor: Bounds): LayoutControl {
  const rect = controlRect(control);
  const centerX = anchor.minX + (anchor.maxX - anchor.minX - rect.width) / 2;
  const centerY = anchor.minY + (anchor.maxY - anchor.minY - rect.height) / 2;
  if (action === "left") {
    return rectToControl(control, { ...rect, left: anchor.minX });
  }
  if (action === "center-x") {
    return rectToControl(control, { ...rect, left: centerX });
  }
  if (action === "right") {
    return rectToControl(control, { ...rect, left: anchor.maxX - rect.width });
  }
  if (action === "top") {
    return rectToControl(control, { ...rect, top: anchor.minY });
  }
  if (action === "center-y") {
    return rectToControl(control, { ...rect, top: centerY });
  }
  return rectToControl(control, { ...rect, top: anchor.maxY - rect.height });
}

function rectToControl(control: LayoutControl, rect: Rect): LayoutControl {
  return {
    ...control,
    left: toPixels(rect.left),
    top: toPixels(rect.top),
    width: toPixels(rect.width),
    height: toPixels(rect.height)
  };
}
