import type { IconButtonProps } from "../editorTypes";

export function IconButton(props: IconButtonProps) {
  return (
    <button
      type="button"
      class={buttonClass(Boolean(props.active))}
      aria-label={props.label}
      aria-keyshortcuts={props.shortcut}
      title={props.shortcut ? `${props.label} (${props.shortcut})` : props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function buttonClass(active: boolean): string {
  const state = active ? "border-action bg-action/20 text-ink" : "border-line bg-[#1d232c] text-muted hover:border-action hover:text-ink";
  return `grid h-10 w-10 place-items-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-35 ${state}`;
}
