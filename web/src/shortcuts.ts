export type ShortcutCommands = {
  readonly recording: () => boolean;
  readonly bindKeyToPrimary: (code: string) => void;
  readonly saveRemote: () => Promise<void>;
  readonly deleteSelection: () => void;
  readonly duplicateSelection: () => void;
  readonly selectAll: () => void;
  readonly deselect: () => void;
  readonly moveSelection: (deltaX: number, deltaY: number) => void;
};

export function handleEditorKeyDown(event: KeyboardEvent, commands: ShortcutCommands): void {
  if (commands.recording()) {
    event.preventDefault();
    commands.bindKeyToPrimary(event.code);
    return;
  }
  if (isEditableTarget(event.target)) {
    if (event.key === "Escape") {
      commands.deselect();
    }
    return;
  }
  const command = event.metaKey || event.ctrlKey;
  const step = event.shiftKey ? 10 : 1;
  if (command && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void commands.saveRemote();
    return;
  }
  if (command && event.key.toLowerCase() === "a") {
    event.preventDefault();
    commands.selectAll();
    return;
  }
  if (command && event.key.toLowerCase() === "d") {
    event.preventDefault();
    commands.duplicateSelection();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    commands.deleteSelection();
    return;
  }
  if (event.key === "Escape") {
    commands.deselect();
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    commands.moveSelection(-step, 0);
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    commands.moveSelection(step, 0);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    commands.moveSelection(0, -step);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    commands.moveSelection(0, step);
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}
