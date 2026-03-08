# Contributing

## Project structure

This is a Cargo workspace with three crates, plus a website:

- **`datagen/`**: Processes Wikipedia dumps to extract music genres and produce data for the website graph. Requires a `config.toml` with paths to Wikipedia dumps and a YouTube API key. Not needed for website development.
- **`frontend_wasm/`**: Rust code compiled to WASM for use in the frontend (fuzzy search, etc).
- **`shared/`**: Types shared between `datagen` and `frontend_wasm` (e.g. `PageName`).
- **`website/`**: React/TypeScript frontend using Vite, Tailwind CSS, and the WASM module.
- **`mixes/`**: One file per genre, containing YouTube video/playlist URLs for that genre's mix. Filenames use sanitized page names (see `shared::PageName`).

All Cargo and `wasm-pack` commands are run from the repo root.

## Prerequisites

- Rust (stable) with the `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) v0.13.1+
- Node.js 20+
- npm

## Building the WASM module

```bash
wasm-pack build --target web frontend_wasm -d ../website/frontend_wasm
```

This outputs the built package to `website/frontend_wasm/`, which is referenced as a `file:` dependency in the website's `package.json`.

## Website development

```bash
cd website
npm install
npm run dev
```

Note that a human developer is likely to already be running `npm run dev`.

## Passing CI

CI runs on every push. To pass locally, run the following from the repo root, doing this only when a batch of changes is complete:

```bash
# Rust
cargo test
cargo clippy -- -D warnings
cargo clippy -p frontend_wasm --target wasm32-unknown-unknown -- -D warnings
cargo run --bin check_missing_mixes --release

# WASM
wasm-pack build --target web frontend_wasm -d ../website/frontend_wasm

# Website (from website/)
cd website
npm run test
npm run lint
```

`npm run lint` checks TypeScript types, ESLint, and Prettier formatting. To auto-fix formatting:

```bash
npm run format
```

## Regenerating data

To regenerate the full dataset (requires Wikipedia dumps and a `config.toml`):

```bash
cargo run --release
```

To regenerate just the force-directed layout after changing `datagen/src/force_layout.rs`:

```bash
cargo run --bin relayout --release
```

## Visualizing the force layout

A `shell.nix` is provided for NixOS/nix users to get the required native
dependencies (libstdc++, zlib) for numpy/matplotlib:

```bash
nix-shell --run "uv run visualize_layout.py"
```

This reads `website/public/data.json` and produces `layout_visualization.png`
with three panels: full layout, core zoom (2σ), and isolated vs connected nodes.
