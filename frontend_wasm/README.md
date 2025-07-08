# `frontend_wasm`

Rust code to use in the frontend.

## Building

```bash
wasm-pack build --target web frontend_wasm -d ../website/frontend_wasm
```

in repo root, or

```bash
wasm-pack build --target web . -d ../website/frontend_wasm
```

in this directory.
