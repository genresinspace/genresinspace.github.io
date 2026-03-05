Ensure that all of the CI passes.

## Visualizing the force layout

A `shell.nix` is provided for NixOS/nix users to get the required native
dependencies (libstdc++, zlib) for numpy/matplotlib:

```bash
nix-shell --run "uv run visualize_layout.py"
```

This reads `website/public/data.json` and produces `layout_visualization.png`
with three panels: full layout, core zoom (2σ), and isolated vs connected nodes.

To regenerate the layout after changing `datagen/src/force_layout.rs`:

```bash
cd datagen && cargo run --bin relayout --release
```
