import { ArrowDownToLine, Gamepad2, Joystick, MousePointer2, RotateCcw, Save, Square, Upload } from "lucide-solid";
import type { Editor } from "../editorTypes";
import { IconButton } from "./IconButton";

export function Toolbar(props: { readonly editor: Editor }) {
  return (
    <aside class="flex flex-col items-center gap-2 border-r border-line bg-panel px-2 py-4 max-[1020px]:flex-row max-[1020px]:border-b max-[1020px]:border-r-0">
      <Gamepad2 class="mb-4 h-8 w-8 text-action max-[1020px]:mb-0" aria-hidden="true" />
      <IconButton label="Add button" onClick={props.editor.addButton}>
        <Square class="h-5 w-5" />
      </IconButton>
      <IconButton label="Add joystick" onClick={props.editor.addJoystick}>
        <Joystick class="h-5 w-5" />
      </IconButton>
      <IconButton label="Add mouse zone" onClick={props.editor.addMouseZone}>
        <MousePointer2 class="h-5 w-5" />
      </IconButton>
      <div class="h-px w-10 bg-line max-[1020px]:h-10 max-[1020px]:w-px" />
      <IconButton label="Load" onClick={() => void props.editor.loadRemote()}>
        <RotateCcw class="h-5 w-5" />
      </IconButton>
      <IconButton label="Save" shortcut="Control+S" onClick={() => void props.editor.saveRemote()}>
        <Save class="h-5 w-5" />
      </IconButton>
      <IconButton label="Export JSON" onClick={props.editor.exportLayout}>
        <ArrowDownToLine class="h-5 w-5" />
      </IconButton>
      <label
        class="grid h-10 w-10 cursor-pointer place-items-center rounded-md border border-line bg-[#1d232c] text-muted transition hover:border-action hover:text-ink"
        title="Import JSON"
        aria-label="Import JSON"
      >
        <Upload class="h-5 w-5" />
        <input class="sr-only" type="file" accept="application/json,.json" onChange={(event) => void props.editor.importLayout(event)} />
      </label>
    </aside>
  );
}
