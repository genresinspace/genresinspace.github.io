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
    /// Represents a fix that has already been applied to Wikipedia
    /// but may not be in the dump being processed.
    struct WikipediaFix {
        /// Timestamp when the fix was applied
        timestamp: &'static str,
        /// Page name and optional heading
        page: (&'static str, Option<String>),
        /// The correct genre name
        name: &'static str,
        /// Link to the Wikipedia edit or discussion
        _link: &'static str,
    }
    const FIXES: &[WikipediaFix] = &[
        WikipediaFix {
            timestamp: "2025-04-26T20:32:00Z",
            page: ("Popcorn (Romanian music style)", None),
            name: "Romanian popcorn",
            _link: "https://en.wikipedia.org/w/index.php?title=Popcorn_(Romanian_music_style)&oldid=1287525657",
        },
        WikipediaFix {
            timestamp: "2025-04-26T20:32:00Z",
            page: ("Popcorn (Belgian music style)", None),
            name: "Belgian popcorn",
            _link: "https://en.wikipedia.org/w/index.php?title=Popcorn_(Belgian_music_style)&oldid=1287525762",
        },
    ];

    FIXES
        .iter()
        .map(|fix| {
            (
                PageName::new(fix.page.0, fix.page.1.clone()),
                (
                    Some(Timestamp::from_str(fix.timestamp).unwrap()),
                    GenreName(fix.name.to_string()),
                ),
            )
        })
        .collect()
}

/// Patches to resolve ambiguity in the source data. I don't feel confident in making
/// these changes myself, so I'm disambiguating them here.
fn unclear_fixes() -> HashMap<PageName, (Option<Timestamp>, GenreName)> {
    /// Represents a fix to resolve ambiguity in the source data
    struct UnclearFix {
        /// Page name and optional heading
        page: (&'static str, Option<&'static str>),
        /// The disambiguated genre name
        name: &'static str,
    }

    const FIXES: &[UnclearFix] = &[
        // HACK: "Calypso music" describes a genre, "Calypso", that originated in Trinidad and Tobago during the early to mid-19th century.
        // "Brega pop" describes a genre, "Calypso", also known as "Brega Calypso" or "Brega-pop", that originated in Brazil in the 1990s.
        // To work around this conflict, I'm renaming the latter to "Brega-pop".
        UnclearFix {
            page: ("Brega pop", None),
            name: "Brega-pop",
        },
    ];

    FIXES
        .iter()
        .map(|fix| {
            (
                PageName::new(fix.page.0, fix.page.1.map(String::from)),
                (None, GenreName(fix.name.to_string())),
            )
        })
        .collect()
}
