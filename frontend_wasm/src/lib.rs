use std::sync::LazyLock;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_and_simplify_wikitext(
    wikitext: &str,
) -> Vec<wikitext_simplified::WikitextSimplifiedNode> {
    static PWT_CONFIGURATION: LazyLock<wikitext_simplified::parse_wiki_text_2::Configuration> =
        LazyLock::new(wikitext_util::wikipedia_pwt_configuration);

    console_error_panic_hook::set_once();

    let output = PWT_CONFIGURATION.parse(wikitext).unwrap();
    wikitext_simplified::simplify_wikitext_nodes(wikitext, &output.nodes).unwrap()
}
