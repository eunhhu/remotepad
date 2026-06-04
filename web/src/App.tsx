import { onCleanup, onMount } from "solid-js";
import { CanvasView } from "./components/CanvasView";
import { Inspector } from "./components/Inspector";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { useEditor } from "./useEditor";

export default function App() {
  const editor = useEditor();

  onMount(() => {
    void editor.loadRemote();
    window.addEventListener("keydown", editor.handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", editor.handleKeyDown);
  });

  return (
    <main class="min-h-screen bg-[#101318] text-ink">
      <div class="grid min-h-screen grid-cols-[64px_minmax(0,1fr)_300px] max-[1020px]:grid-cols-1">
        <Toolbar editor={editor} />
        <section class="min-w-0 bg-[#12161d]">
          <TopBar editor={editor} />
          <CanvasView editor={editor} />
        </section>
        <Inspector editor={editor} />
      </div>
    </main>
  );
}
