import { getRouteAnchor } from "./nodeActivation";

const PATH = ["a", "b", "c", "d", "e"];

describe("getRouteAnchor", () => {
  it("anchors on the selected node when it lies on the path", () => {
    expect(getRouteAnchor("c", PATH)).toBe("c");
  });

  it("anchors on the path's source when the selection is off the path", () => {
    expect(getRouteAnchor("z", PATH)).toBe("a");
  });

  it("anchors on the path's source when nothing is selected", () => {
    expect(getRouteAnchor(null, PATH)).toBe("a");
  });

  it("anchors on the selection when there is no path", () => {
    expect(getRouteAnchor("z", null)).toBe("z");
  });

  it("has no anchor when neither is set", () => {
    expect(getRouteAnchor(null, null)).toBeNull();
  });
});
