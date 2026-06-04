import { z } from "zod";

export const controlKinds = ["Button", "Joystick", "MouseZone"] as const;
export type ControlKind = (typeof controlKinds)[number];

const cssValue = z.string().min(1);

export const controlSchema = z.object({
  type: z.enum(controlKinds),
  left: cssValue,
  top: cssValue,
  width: cssValue,
  height: cssValue,
  borderRadius: z.string().default("0px"),
  transform: z.string().default(""),
  key: z.string().default("")
});

export const layoutSchema = z.object({
  canvasSize: z.object({
    width: cssValue,
    height: cssValue
  }),
  controls: z.array(controlSchema)
});

export type LayoutControl = z.infer<typeof controlSchema>;
export type Layout = z.infer<typeof layoutSchema>;

export type CanvasPreset = {
  readonly label: string;
  readonly width: number;
  readonly height: number;
};

export const canvasPresets: readonly CanvasPreset[] = [
  { label: "iPhone compact", width: 390, height: 844 },
  { label: "iPhone large", width: 430, height: 932 },
  { label: "iPad 11", width: 834, height: 1194 },
  { label: "iPad 13", width: 1032, height: 1376 },
  { label: "Steam Deck", width: 1280, height: 800 },
  { label: "Custom wide", width: 820, height: 420 }
];

export const defaultLayout: Layout = {
  canvasSize: {
    width: "820px",
    height: "420px"
  },
  controls: [
    {
      type: "Button",
      left: "32px",
      top: "272px",
      width: "88px",
      height: "88px",
      borderRadius: "18px",
      transform: "",
      key: "KeyZ"
    },
    {
      type: "Button",
      left: "136px",
      top: "248px",
      width: "88px",
      height: "88px",
      borderRadius: "18px",
      transform: "",
      key: "KeyX"
    },
    {
      type: "Button",
      left: "240px",
      top: "272px",
      width: "88px",
      height: "88px",
      borderRadius: "18px",
      transform: "",
      key: "KeyC"
    },
    {
      type: "Button",
      left: "600px",
      top: "84px",
      width: "82px",
      height: "82px",
      borderRadius: "999px",
      transform: "",
      key: "ArrowUp"
    },
    {
      type: "Button",
      left: "516px",
      top: "170px",
      width: "82px",
      height: "82px",
      borderRadius: "999px",
      transform: "",
      key: "ArrowLeft"
    },
    {
      type: "Button",
      left: "684px",
      top: "170px",
      width: "82px",
      height: "82px",
      borderRadius: "999px",
      transform: "",
      key: "ArrowRight"
    },
    {
      type: "Button",
      left: "600px",
      top: "256px",
      width: "82px",
      height: "82px",
      borderRadius: "999px",
      transform: "",
      key: "ArrowDown"
    }
  ]
};

export function parseLayout(input: unknown): Layout {
  return layoutSchema.parse(input);
}

export function serializeLayout(layout: Layout): string {
  return JSON.stringify(parseLayout(layout), null, 2);
}

export function readPixels(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toPixels(value: number): string {
  return `${Math.round(value)}px`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function cloneLayout(layout: Layout): Layout {
  return parseLayout(JSON.parse(serializeLayout(layout)));
}

export function createControl(type: ControlKind, index: number): LayoutControl {
  const offset = index * 16;
  if (type === "Joystick") {
    return {
      type,
      left: toPixels(72 + offset),
      top: "88px",
      width: "136px",
      height: "136px",
      borderRadius: "999px",
      transform: "",
      key: "Mouse"
    };
  }
  if (type === "MouseZone") {
    return {
      type,
      left: toPixels(320 + offset),
      top: "72px",
      width: "220px",
      height: "168px",
      borderRadius: "12px",
      transform: "",
      key: "MouseLeft"
    };
  }
  return {
    type,
    left: toPixels(120 + offset),
    top: "240px",
    width: "88px",
    height: "88px",
    borderRadius: "18px",
    transform: "",
    key: "KeyA"
  };
}
