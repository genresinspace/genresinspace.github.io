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
cargo fmt --all -- --check
cargo test
cargo clippy -- -D warnings
cargo clippy -p frontend_wasm --target wasm32-unknown-unknown -- -D warnings
cargo run --bin check_missing_mixes --release
cargo run --bin check_suspicious_edges --release

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

To auto-fix Rust formatting:

```bash
cargo fmt --all
```

Clippy warnings can often be auto-fixed:

```bash
cargo clippy --fix -- -D warnings
```

## Updating the data

Refreshing the dataset from a new Wikipedia dump takes a few steps. Run everything from the repo root unless noted.

1. Download a dump. Pick a date from [dumps.wikimedia.org](https://dumps.wikimedia.org/enwiki/) and fetch it into a directory of your choosing; the files land in `<directory>/<date>/`:

   ```bash
   ./scripts/download_dump.fish 2026-07-01 /path/to/dumps
   ```

2. Point `wikipedia_dump_dir` in `config.toml` at that `<directory>/<date>/` directory.

3. Regenerate the dataset. This parses the dump and rewrites the graph data and per-genre/artist files under `website/public/`:

   ```bash
   cargo run --release
   ```

4. From `website`, run `npm run test`. This renders every genre and artist description and fails on templates or language tags the new dump introduces that aren't handled yet. Add handlers under `website/src/views/components/wikipedia/templates/`, and language tags in `IetfLanguageTagLink.tsx`, until it passes.

5. Fill in mixes for any new genres. This reruns the pipeline and populates YouTube mixes (under `mixes/`) for genres that don't have one:

   ```bash
   cargo run --release -- --populate-mixes
   ```

6. Check for suspicious edges. This flags "derivative" edges where an obscure source genre supposedly influences a far more prominent one - measured by node degree, where a low-degree source points at a much higher-degree target (at least 5x its degree, target degree ≥ 15). These usually come from a mistake in a Wikipedia infobox. Review each and record your decision in `datagen/src/data_patches.rs`, adding it to either `edges_to_accept()` or `edges_to_reject()`:

   ```bash
   cargo run --bin check_suspicious_edges --release
   ```

To redo just the force-directed layout after changing `datagen/src/force_layout.rs`:

```bash
cargo run --bin relayout --release
```

## Visualizing the force layout

A `shell.nix` provides the native dependencies (libstdc++, zlib) that numpy/matplotlib need on NixOS/nix:

```bash
nix-shell --run "uv run visualize_layout.py"
```

This reads `website/public/data.json` and writes `layout_visualization.png` with three panels: full layout, core zoom (2σ), and isolated vs connected nodes.
