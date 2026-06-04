import { describe, expect, it } from "vitest";
import type { Layout } from "./layout";
import { alignControls, distributeControls, moveControls, resizeControl } from "./geometry";

const layout: Layout = {
  canvasSize: { width: "400px", height: "300px" },
  controls: [
    { type: "Button", left: "20px", top: "30px", width: "50px", height: "40px", borderRadius: "8px", transform: "", key: "KeyA" },
    { type: "Button", left: "140px", top: "90px", width: "50px", height: "40px", borderRadius: "8px", transform: "", key: "KeyB" },
    { type: "Button", left: "280px", top: "120px", width: "50px", height: "40px", borderRadius: "8px", transform: "", key: "KeyC" }
  ]
};

describe("geometry", () => {
  it("moves selected controls within canvas bounds", () => {
    const next = moveControls(layout, [0, 1], 500, 500);
    expect(next.controls[0]?.left).toBe("350px");
    expect(next.controls[0]?.top).toBe("260px");
    expect(next.controls[1]?.left).toBe("350px");
    expect(next.controls[1]?.top).toBe("260px");
    expect(next.controls[2]?.left).toBe("280px");
  });

  it("resizes a control from the south east handle", () => {
    const next = resizeControl(layout, 0, "se", 30, 20);
    expect(next.controls[0]?.width).toBe("80px");
    expect(next.controls[0]?.height).toBe("60px");
  });

  it("aligns multiple controls to the left edge of the selection", () => {
    const next = alignControls(layout, [0, 1, 2], "left");
    expect(next.controls[0]?.left).toBe("20px");
    expect(next.controls[1]?.left).toBe("20px");
    expect(next.controls[2]?.left).toBe("20px");
  });

  it("distributes selected controls on the x axis", () => {
    const next = distributeControls(layout, [0, 1, 2], "x");
    expect(next.controls[0]?.left).toBe("20px");
    expect(next.controls[1]?.left).toBe("150px");
    expect(next.controls[2]?.left).toBe("280px");
  });
});
