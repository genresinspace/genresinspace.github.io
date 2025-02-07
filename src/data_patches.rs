use std::{collections::HashMap, str::FromStr};

use jiff::Timestamp;

pub fn all() -> HashMap<String, (Option<Timestamp>, String)> {
    fixed_already().into_iter().chain(unclear_fixes()).collect()
}

pub const PAGES_TO_IGNORE: &[&str] = &[
    // Redefines jazz as a genre; redundant with the "Jazz" article
    "Outline of jazz",
];

/// Patches that have already been applied to Wikipedia, but may not be
/// in the dump being processed.
fn fixed_already() -> HashMap<String, (Option<Timestamp>, String)> {
    [
        //  The infobox for the page 'Sanedo' is wrong and uses 'Rasiya' as the genre name.
        // Fixed: https://en.wikipedia.org/w/index.php?title=Sanedo&oldid=1274517946
        ("2025-02-07T20:02:00Z", "Sanedo", "Sanedo"),
        // "Western music (North America)" had a space in its genre name.
        // Fixed: https://en.wikipedia.org/w/index.php?title=Western_music_(North_America)&oldid=1274523831
        (
            "2025-02-07T20:42:00Z",
            "Western music (North America)",
            "Western music",
        ),
        // "Cajun music" and "Cajun fiddle" both use the same genre name of "Cajun music".
        // Fixed: https://en.wikipedia.org/w/index.php?title=Cajun_fiddle&oldid=1274524250
        ("2025-02-07T20:46:00Z", "Cajun fiddle", "Cajun fiddle"),
    ]
    .into_iter()
    .map(|(timestamp, page, name)| {
        (
            page.to_string(),
            (
                Some(Timestamp::from_str(timestamp).unwrap()),
                name.to_string(),
            ),
        )
    })
    .collect()
}

/// Patches to resolve ambiguity in the source data. I don't feel confident in making
/// these changes myself, so I'm disambiguating them here.
fn unclear_fixes() -> HashMap<String, (Option<Timestamp>, String)> {
    [
        // HACK: "Calypso music" describes a genre, "Calypso", that originated in Trinidad and Tobago during the early to mid-19th century.
        // "Brega pop" describes a genre, "Calypso", also known as "Brega Calypso" or "Brega-pop", that originated in Brazil in the 1990s.
        // To work around this conflict, I'm renaming the latter to "Brega-pop".
        ("Brega pop", "Brega-pop"),
    ]
    .into_iter()
    .map(|(page, name)| (page.to_string(), (None, name.to_string())))
    .collect()
}
