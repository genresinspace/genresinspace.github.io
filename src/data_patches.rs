//! Patches for Wikipedia data to deal with ambiguities and errors that may have been fixed after
//! the dump was created.

use std::{collections::HashMap, str::FromStr};

use jiff::Timestamp;

use crate::types::{GenreName, PageName};

/// All data patches.
pub fn all() -> HashMap<PageName, (Option<Timestamp>, GenreName)> {
    fixed_already().into_iter().chain(unclear_fixes()).collect()
}

/// Pages to ignore when processing Wikipedia.
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
    #[allow(clippy::type_complexity)]
    const FIXES: &[(&str, (&str, Option<String>), &str, &str)] = &[];

    FIXES
        .iter()
        .map(|(timestamp, (page, heading), name, _link)| {
            (
                PageName::new(*page, heading.clone()),
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
