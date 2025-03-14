use std::{collections::HashMap, str::FromStr};

use jiff::Timestamp;

use crate::types::{GenreName, PageName};

pub fn all() -> HashMap<PageName, (Option<Timestamp>, GenreName)> {
    fixed_already().into_iter().chain(unclear_fixes()).collect()
}

pub fn pages_to_ignore() -> Vec<PageName> {
    [
        // Redefines jazz as a genre; redundant with the "Jazz" article
        "Outline of jazz",
    ]
    .into_iter()
    .map(|page| PageName::new(page, None))
    .collect()
}

/// Patches that have already been applied to Wikipedia, but may not be
/// in the dump being processed.
fn fixed_already() -> HashMap<PageName, (Option<Timestamp>, GenreName)> {
    [
        // The infobox for the page 'Hip-hop in the Pacific Northwest' has a = instead of a - in the name.
        (
            "2025-02-28T11:03:00Z",
            ("Hip-hop in the Pacific Northwest", None),
            "Hip-hop in the Pacific Northwest",
            "https://en.wikipedia.org/w/index.php?title=Hip-hop_in_the_Pacific_Northwest&oldid=1278081681",
        ),
    ]
    .into_iter()
    .map(|(timestamp, (page, heading), name, _link)| {
        (
            PageName::new(page, heading),
            (
                Some(Timestamp::from_str(timestamp).unwrap()),
                GenreName(name.to_string()),
            ),
        )
    })
    .collect()
}

/// Patches to resolve ambiguity in the source data. I don't feel confident in making
/// these changes myself, so I'm disambiguating them here.
fn unclear_fixes() -> HashMap<PageName, (Option<Timestamp>, GenreName)> {
    [
        // HACK: "Calypso music" describes a genre, "Calypso", that originated in Trinidad and Tobago during the early to mid-19th century.
        // "Brega pop" describes a genre, "Calypso", also known as "Brega Calypso" or "Brega-pop", that originated in Brazil in the 1990s.
        // To work around this conflict, I'm renaming the latter to "Brega-pop".
        (("Brega pop", None), "Brega-pop"),
    ]
    .into_iter()
    .map(|((page, heading), name)| {
        (
            PageName::new(page, heading),
            (None, GenreName(name.to_string())),
        )
    })
    .collect()
}
