use std::{collections::HashMap, str::FromStr};

use jiff::Timestamp;

use crate::{GenreName, PageName};

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
        // The infobox for the page 'Sanedo' is wrong and uses 'Rasiya' as the genre name.
        (
            "2025-02-07T20:02:00Z",
            ("Sanedo", None),
            "Sanedo",
            "https://en.wikipedia.org/w/index.php?title=Sanedo&oldid=1274517946",
        ),
        // "Western music (North America)" had a space in its genre name.
        (
            "2025-02-07T20:42:00Z",
            ("Western music (North America)", None),
            "Western music",
            "https://en.wikipedia.org/w/index.php?title=Western_music_(North_America)&oldid=1274523831",
        ),
        // "Cajun music" and "Cajun fiddle" both use the same genre name of "Cajun music".
        (
            "2025-02-07T20:46:00Z",
            ("Cajun fiddle", None),
            "Cajun fiddle",
            "https://en.wikipedia.org/w/index.php?title=Cajun_fiddle&oldid=1274524250"
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
