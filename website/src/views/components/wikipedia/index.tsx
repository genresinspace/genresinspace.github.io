import init from "wikitext_simplified";

/**
 * Initialize the Wikitext Simplified WASM module.
 */
export const initWasm = async (binary?: Buffer) => {
  return init({ module_or_path: binary });
};
