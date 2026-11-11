import { resolveRetarget } from "./nodeActivation";

// Route A to E stands for a five-node path; A to B for a two-node one.
const PATH_SOURCE = "a";
const PATH_DESTINATION = "e";

describe("resolveRetarget", () => {
  it("pairs the hovered node with the selected middle node in both directions", () => {
    expect(
      resolveRetarget("x", "source", "c", PATH_SOURCE, PATH_DESTINATION)
    ).toEqual({ sourceId: "x", destinationId: "c" });
    expect(
      resolveRetarget("x", "destination", "c", PATH_SOURCE, PATH_DESTINATION)
    ).toEqual({ sourceId: "c", destinationId: "x" });
  });

  it("keeps the source when the selection is the destination", () => {
    expect(resolveRetarget("c", "destination", "b", "a", "b")).toEqual({
      sourceId: "a",
      destinationId: "c",
    });
  });

  it("keeps the destination when the selection is the source", () => {
    expect(resolveRetarget("x", "source", "a", "a", "b")).toEqual({
      sourceId: "x",
      destinationId: "b",
    });
    expect(resolveRetarget("c", "destination", "a", "a", "b")).toEqual({
      sourceId: "a",
      destinationId: "c",
    });
  });

  it("pairs with the source when the destination is not set", () => {
    expect(resolveRetarget("x", "destination", "a", "a", null)).toEqual({
      sourceId: "a",
      destinationId: "x",
    });
  });

  it("pairs with the destination when the selection is unset", () => {
    expect(resolveRetarget("x", "source", null, null, "b")).toEqual({
      sourceId: "x",
      destinationId: "b",
    });
  });

  it("has no target where the route already holds the result", () => {
    expect(resolveRetarget("b", "destination", "a", "a", "b")).toBeNull();
    expect(resolveRetarget("a", "source", "a", "a", "b")).toBeNull();
    expect(resolveRetarget("b", "destination", "b", "a", "b")).toBeNull();
  });

  it("has no target where the hovered node is the partner", () => {
    expect(
      resolveRetarget("c", "source", "c", PATH_SOURCE, PATH_DESTINATION)
    ).toBeNull();
    expect(resolveRetarget("a", "destination", "a", "a", "b")).toBeNull();
  });

  it("has no target where nothing can supply the other end", () => {
    expect(resolveRetarget("x", "destination", null, null, null)).toBeNull();
  });
});
