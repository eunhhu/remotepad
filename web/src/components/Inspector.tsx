import { Keyboard, Trash2 } from "lucide-solid";
import { For, Show } from "solid-js";
import { minControlSize } from "../geometry";
import type { Editor } from "../editorTypes";
import { controlKinds, readPixels } from "../layout";
import { parseControlKind } from "../useEditor";
import { IconButton } from "./IconButton";

export function Inspector(props: { readonly editor: Editor }) {
  const selectedCount = () => props.editor.selectedIndices().length;
  return (
    <aside class="border-l border-line bg-panel max-[1020px]:border-l-0 max-[1020px]:border-t">
      <div class="flex h-14 items-center justify-between border-b border-line px-4">
        <span class="text-sm font-semibold">Inspector</span>
        <div class="flex items-center gap-2">
          <IconButton label="Record key" active={props.editor.recording()} disabled={!props.editor.primaryControl()} onClick={props.editor.startKeyRecording}>
            <Keyboard class="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete" disabled={selectedCount() === 0} onClick={props.editor.deleteSelection}>
            <Trash2 class="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div class="space-y-4 p-4">
        <Field label="Canvas W">
          <NumberInput value={props.editor.canvasWidth()} onInput={(value) => props.editor.updateCanvas("width", value)} />
        </Field>
        <Field label="Canvas H">
          <NumberInput value={props.editor.canvasHeight()} onInput={(value) => props.editor.updateCanvas("height", value)} />
        </Field>

        <div class="h-px bg-line" />

        <Show when={props.editor.primaryControl()} fallback={<p class="text-sm text-muted">{selectedCount()} selected</p>}>
          {(control) => (
            <div class="space-y-4">
              <div class="flex items-center justify-between text-xs text-muted">
                <span>{selectedCount()} selected</span>
                <span>#{primaryLabel(props.editor.primaryIndex())}</span>
              </div>
              <Field label="Type">
                <select
                  class="input"
                  value={control().type}
                  onInput={(event) => {
                    const nextType = parseControlKind(event.currentTarget.value);
                    if (nextType) {
                      props.editor.updatePrimary({ type: nextType });
                    }
                  }}
                >
                  <For each={controlKinds}>{(kind) => <option value={kind}>{kind}</option>}</For>
                </select>
              </Field>
              <Field label="Key">
                <input class="input" value={control().key} spellcheck={false} onInput={(event) => props.editor.updatePrimary({ key: event.currentTarget.value })} />
              </Field>
              <div class="grid grid-cols-2 gap-3">
                <Field label="X">
                  <NumberInput value={readPixels(control().left, 0)} onInput={(value) => props.editor.updatePrimaryNumeric("left", value)} />
                </Field>
                <Field label="Y">
                  <NumberInput value={readPixels(control().top, 0)} onInput={(value) => props.editor.updatePrimaryNumeric("top", value)} />
                </Field>
                <Field label="W">
                  <NumberInput value={readPixels(control().width, minControlSize)} onInput={(value) => props.editor.updatePrimaryNumeric("width", value)} />
                </Field>
                <Field label="H">
                  <NumberInput value={readPixels(control().height, minControlSize)} onInput={(value) => props.editor.updatePrimaryNumeric("height", value)} />
                </Field>
              </div>
              <Field label="Radius">
                <NumberInput value={readPixels(control().borderRadius, 0)} onInput={(value) => props.editor.updatePrimaryNumeric("borderRadius", value)} />
              </Field>
            </div>
          )}
        </Show>
      </div>
    </aside>
  );
}

function Field(props: { readonly label: string; readonly children: import("solid-js").JSX.Element }) {
  return (
    <label class="block space-y-1.5">
      <span class="text-xs font-medium uppercase text-muted">{props.label}</span>
      {props.children}
    </label>
  );
}

function NumberInput(props: { readonly value: number; readonly onInput: (value: string) => void }) {
  return <input class="input" type="number" inputmode="numeric" value={props.value} onInput={(event) => props.onInput(event.currentTarget.value)} />;
}

function primaryLabel(index: number | undefined): string {
  return index === undefined ? "-" : String(index + 1);
}
