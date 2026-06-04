import type { Accessor, JSX, Setter } from "solid-js";
import type { Layout, LayoutControl } from "./layout";
import type { AlignmentAction, DistributionAxis, NumericField, Rect, ResizeHandle } from "./geometry";

export type StatusKind = "idle" | "saving" | "ok" | "error" | "recording";

export type Status = {
  readonly kind: StatusKind;
  readonly text: string;
};

export type SelectionMode = "replace" | "toggle" | "add";

export type Editor = {
  readonly layout: Accessor<Layout>;
  readonly selectedIndices: Accessor<readonly number[]>;
  readonly selectedControls: Accessor<readonly LayoutControl[]>;
  readonly primaryIndex: Accessor<number | undefined>;
  readonly primaryControl: Accessor<LayoutControl | undefined>;
  readonly status: Accessor<Status>;
  readonly recording: Accessor<boolean>;
  readonly canvasWidth: Accessor<number>;
  readonly canvasHeight: Accessor<number>;
  readonly setStatus: Setter<Status>;
  readonly loadRemote: () => Promise<void>;
  readonly saveRemote: () => Promise<void>;
  readonly exportLayout: () => void;
  readonly importLayout: (event: Event) => Promise<void>;
  readonly addButton: () => void;
  readonly addJoystick: () => void;
  readonly addMouseZone: () => void;
  readonly deleteSelection: () => void;
  readonly duplicateSelection: () => void;
  readonly selectControl: (index: number, mode: SelectionMode) => void;
  readonly selectAll: () => void;
  readonly deselect: () => void;
  readonly selectWithinRect: (rect: Rect, mode: SelectionMode) => void;
  readonly moveSelection: (deltaX: number, deltaY: number) => void;
  readonly resizePrimary: (handle: ResizeHandle, deltaX: number, deltaY: number) => void;
  readonly alignSelection: (action: AlignmentAction) => void;
  readonly distributeSelection: (axis: DistributionAxis) => void;
  readonly updateCanvas: (field: "width" | "height", value: string) => void;
  readonly updatePrimary: (patch: Partial<LayoutControl>) => void;
  readonly updatePrimaryNumeric: (field: NumericField, value: string) => void;
  readonly startKeyRecording: () => void;
  readonly bindKeyToPrimary: (code: string) => void;
  readonly handleKeyDown: (event: KeyboardEvent) => void;
};

export type IconButtonProps = {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: JSX.Element;
  readonly disabled?: boolean;
  readonly active?: boolean;
  readonly shortcut?: string;
};
