import init from "frontend_wasm";

/**
 * Initialize the Frontend WASM module.
 */
export const initWasm = async (binary?: Buffer) => {
  return init({ module_or_path: binary });
};
