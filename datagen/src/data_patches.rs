//! Patches for Wikipedia data to deal with ambiguities and errors that may have been fixed after
//! the dump was created.

use std::{
    collections::{BTreeMap, BTreeSet},
    str::FromStr,
};

use jiff::Timestamp;

use crate::{
    frontend_types::EdgeType,
    types::{ArtistName, GenreName, PageName},
};

/// Pages to ignore when processing Wikipedia.
pub fn pages_to_ignore() -> Vec<PageName> {
    [
        // Redefines jazz as a genre; redundant with the "Jazz" article
        ("Outline of jazz", None),
        // The "Styles of pop music" page redefined these genres instead of linking to
        // dedicated articles with subsections describing them (including their infoboxes).
        // I've fixed this in <https://en.wikipedia.org/w/index.php?title=Styles_of_pop_music&oldid=1288729877>,
        // but I'm explicitly ignoring them here so that we have a solution until the next dump (after 2025-05-04).
        //
        // Redefines pop soul, which already has a subarticle.
        ("Styles of pop music", Some("Pop soul / Motown")),
        // Redefines street pop, which already has a subarticle.
        ("Styles of pop music", Some("Street pop")),
        // Redefines post-industrial, which already has a subarticle.
        ("List of industrial music genres", Some("Post-Industrial")),
    ]
    .into_iter()
    .map(|(page, subheading)| PageName::new(page, subheading.map(String::from)))
    .collect()
}

/// All artist data patches.
pub fn artist_all() -> BTreeMap<PageName, (Option<Timestamp>, ArtistName)> {
    BTreeMap::new()
}

/// All genre data patches.
pub fn genre_all() -> BTreeMap<PageName, (Option<Timestamp>, GenreName)> {
    genre_fixed_already()
        .into_iter()
        .chain(genre_unclear_fixes())
        .collect()
}

/// Patches that have already been applied to Wikipedia, but may not be
/// in the dump being processed.
fn genre_fixed_already() -> BTreeMap<PageName, (Option<Timestamp>, GenreName)> {
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
    const FIXES: &[WikipediaFix] = &[WikipediaFix {
        timestamp: "2025-04-26T20:32:00Z",
        page: ("Popcorn (Romanian music style)", None),
        name: "Romanian popcorn",
        _link: "https://en.wikipedia.org/w/index.php?title=Popcorn_(Romanian_music_style)&oldid=1287525657",
    }];

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
fn genre_unclear_fixes() -> BTreeMap<PageName, (Option<Timestamp>, GenreName)> {
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
        // HACK: There are two genres referred to as "Popcorn" on Wikipedia. I've updated the Romanian version to "Romanian popcorn" and
        // the Belgian version to "Belgian popcorn", but my change to the Belgian version was reverted. As a result, I've had to move it
        // to an ambiguity fix.
        UnclearFix {
            page: ("Popcorn (Belgian music style)", None),
            name: "Belgian popcorn",
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

/// Edges confirmed incorrect that should be filtered out during datagen.
///
/// Returns a set of `(source_name, target_name, edge_type)` tuples identifying edges to reject.
/// Edge direction: source influenced target.
pub fn edges_to_reject() -> BTreeSet<(GenreName, GenreName, EdgeType)> {
    use EdgeType::Derivative as D;
    [
        // Americana is a 1990s genre label; R&B (1940s) and rock and roll (1950s) predate it
        ("Americana", "Rhythm and blues", D),
        ("Americana", "Rock and roll", D),
        // C-pop (Chinese popular music) did not influence R&B
        ("C-pop", "Rhythm and blues", D),
        // Ethiopian hip hop (1990s+) cannot have influenced genres from decades earlier
        ("Ethiopian hip hop music", "Funk", D),
        ("Ethiopian hip hop music", "Jazz", D),
        ("Ethiopian hip hop music", "Soul", D),
        // LGBTQ music is a cultural categorization, not a genre that musically derived
        // disco or house; LGBTQ communities were central to those scenes, but that's
        // cultural context, not genre derivation
        ("LGBTQ music", "Disco", D),
        ("LGBTQ music", "House music", D),
        // Louisiana Creole/Cajun music influencing country and R&B is reasonable, but
        // a direct influence on hip-hop is too much of a stretch
        ("Louisiana Creole and Cajun music", "Hip-hop", D),
        // Narcocorrido is a 1970s+ Mexican subgenre; country music (1920s+) predates it
        ("Narcocorrido", "Country music", D),
        // Trip hop emerged from Bristol (Massive Attack, Portishead); no evidence
        // Scottish hip-hop influenced it
        ("Scottish hip -hop", "Trip hop", D),
    ]
    .into_iter()
    .map(|(source, target, ty)| {
        (
            GenreName(source.to_string()),
            GenreName(target.to_string()),
            ty,
        )
    })
    .collect()
}

/// Edges flagged by the suspicious-edge heuristic but confirmed correct.
///
/// Returns a set of `(source_name, target_name, edge_type)` tuples that suppress warnings.
/// Edge direction: source influenced target.
pub fn edges_to_accept() -> BTreeSet<(GenreName, GenreName, EdgeType)> {
    use EdgeType::Derivative as D;
    [
        // --- Foundational/precursor relationships (unambiguous music history) ---
        // African music traditions fed into American popular music through the blues
        ("African blues", "Rhythm and blues", D),
        ("African blues", "Rock and roll", D),
        ("African blues", "Swing", D),
        // Appalachian folk is the main precursor of country music
        ("Appalachian music", "Country music", D),
        // Art pop artists (Bowie, Roxy Music) directly influenced these movements
        ("Art pop", "New wave", D),
        ("Art pop", "Post-punk", D),
        ("Art pop", "Synth-pop", D),
        // Avant-funk experimentation (e.g. Talking Heads) influenced early house
        ("Avant-funk", "House music", D),
        // Bahamian spiritual tradition is related to gospel traditions
        ("Bahamian Rhyming Spiritual", "Gospel music", D),
        // Motörhead-style biker metal bridged metal and punk, influencing both
        ("Biker metal", "Extreme metal", D),
        ("Biker metal", "Hardcore punk", D),
        // Gospel music influenced soul which influenced funk
        ("Black gospel music", "Funk", D),
        // Boogie is a documented precursor to house music
        ("Boogie", "House music", D),
        // Boogie-woogie piano rhythms fed into early R&B and rock and roll
        ("Boogie-woogie", "Rhythm and blues", D),
        ("Boogie-woogie", "Rock and roll", D),
        // British R&B bands (Yardbirds, etc.) went psychedelic
        ("British rhythm and blues", "Psychedelic rock", D),
        // British rock and roll directly spawned the beat and blues rock movements
        ("British rock and roll", "Beat", D),
        ("British rock and roll", "Blues rock", D),
        // Ramones and others cited bubblegum pop as an influence on punk
        ("Bubblegum", "Punk rock", D),
        // Cadence rampa directly spawned zouk in the French Antilles
        ("Cadence rampa", "Zouk", D),
        // Cajun music influenced country, particularly in Louisiana
        ("Cajun music", "Country music", D),
        // College rock is the direct precursor to alternative and indie rock
        ("College rock", "Alternative rock", D),
        ("College rock", "Indie rock", D),
        // Louisiana Creole traditions influenced country, R&B, and rock
        ("Creole music of Louisiana", "Country music", D),
        // Danger music and noise music are connected experimental traditions
        ("Danger music", "Noise music", D),
        // Darkcore was one of the precursors to drum and bass
        ("Darkcore", "Drum and bass", D),
        // Hip-hop production heavily samples raw funk records ("deep funk" 45s)
        ("Deep funk", "Hip-hop", D),
        // Doo-wop vocal harmonies influenced soul music
        ("Doo-wop", "Soul", D),
        // Dub's studio techniques (echo, reverb, remix culture) influenced hip-hop
        ("Dub", "Hip-hop", D),
        // The Dunedin (NZ) sound influenced the broader indie rock movement
        ("Dunedin sound", "Indie rock", D),
        // Traditional Mexican music influenced Mexican pop
        ("Duranguense", "Mexican pop", D),
        // Electric blues directly spawned rock and roll and rock
        ("Electric blues", "Rock and roll", D),
        ("Electric blues", "Rock", D),
        // Eurodisco influenced both house and techno
        ("Eurodisco", "House music", D),
        ("Eurodisco", "Techno", D),
        // Folk jazz's meditative qualities connect to new-age music
        ("Folk jazz", "New-age", D),
        // Funk rock had crossover influence on new wave
        ("Funk rock", "New wave", D),
        // Glam punk (New York Dolls, etc.) influenced both new wave and punk
        ("Glam punk", "New wave", D),
        ("Glam punk", "Punk rock", D),
        // Gwo ka (Guadeloupean tradition) fed into zouk
        ("Gwo ka", "Zouk", D),
        // Instrumental rock had some influence on garage rock
        ("Instrumental rock", "Garage rock", D),
        // Italo disco is a well-documented influence on techno
        ("Italo disco", "Techno", D),
        // Jump blues is essentially proto-R&B and fed directly into rock and roll
        ("Jump blues", "Rhythm and blues", D),
        ("Jump blues", "Rock and roll", D),
        // Light music / mood music / "furniture music" (Satie) influenced ambient
        ("Light music", "Ambient music", D),
        // Louisiana Creole/Cajun music influenced country, R&B, and rock and roll
        ("Louisiana Creole and Cajun music", "Country music", D),
        ("Louisiana Creole and Cajun music", "Rhythm and blues", D),
        ("Louisiana Creole and Cajun music", "Rock and roll", D),
        // Latin rhythms (mambo) influenced funk (James Brown cited mambo)
        ("Mambo", "Funk", D),
        // Stax/Memphis soul artists directly influenced funk
        ("Memphis soul", "Funk", D),
        // Mento is a precursor in the mento → ska → rocksteady → reggae lineage
        ("Mento", "Reggae", D),
        // New Mexico music has regional connections to country
        ("New Mexico music", "Country music", D),
        // New musick and post-punk were connected movements
        ("New musick", "Post-punk", D),
        // New Orleans R&B directly influenced Jamaican ska
        ("New Orleans rhythm and blues", "Ska", D),
        // New Orleans soul directly influenced funk
        ("New Orleans soul", "Funk", D),
        // Early metal (Black Sabbath) had occult rock themes
        ("Occult rock", "Heavy metal", D),
        // Old-time music is the direct precursor to country
        ("Old-time music", "Country music", D),
        // Orchestral jazz arrangements are the foundation of swing
        ("Orchestral Jazz", "Swing", D),
        // Philadelphia soul's lush arrangements directly birthed disco
        ("Philadelphia soul", "Disco", D),
        // Public Enemy and politically conscious hip-hop influenced gangsta rap
        ("Political hip hop", "Gangsta rap", D),
        // Preaching chord progressions are foundational to gospel music
        ("Preaching Chords", "Gospel music", D),
        // Proto-punk is by definition the precursor to punk rock
        ("Proto-punk", "Punk rock", D),
        // Psychedelic soul influenced disco
        ("Psychedelic soul", "Disco", D),
        // The pub rock scene in London directly spawned UK punk
        ("Pub rock", "Punk rock", D),
        // Indian musical influences (raga) were central to psychedelic rock
        ("Raga rock", "Psychedelic rock", D),
        // Ragtime is a direct precursor to jazz
        ("Ragtime", "Jazz", D),
        // Red dirt is a subgenre/offshoot of country
        ("Red dirt", "Country music", D),
        // Reggae en Español is in the direct lineage to reggaeton
        ("Reggae en Español", "Reggaeton", D),
        // Rocksteady directly preceded reggae
        ("Rocksteady", "Reggae", D),
        // Roots reggae and dub are closely related
        ("Roots reggae", "Dub", D),
        // Smooth soul evolved into contemporary R&B
        ("Smooth soul", "Contemporary R&B", D),
        // Snap music influenced trap music
        ("Snap music", "Trap music", D),
        // Traditional Mexican music influenced Mexican pop
        ("Son huasteco", "Mexican pop", D),
        ("Son jarocho", "Mexican pop", D),
        // Southern gospel and country share deep roots
        ("Southern gospel", "Country music", D),
        // Spirituals are foundational to blues, jazz, and R&B
        ("Spiritual", "Blues", D),
        ("Spiritual", "Jazz", D),
        ("Spiritual", "Rhythm and blues", D),
        // Dick Dale and surf rock influenced punk rock
        ("Surf music", "Punk rock", D),
        // Symphonic mugham is a form of world music
        ("Symphonic mugham", "World music", D),
        // Tejano and country have cross-pollinated
        ("Tejano music", "Country music", D),
        // Gospel is foundational to R&B and soul
        ("Traditional Black gospel", "Rhythm and blues", D),
        ("Traditional Black gospel", "Soul", D),
        // Traditional pop evolved into modern pop music
        ("Traditional pop", "Pop music", D),
        // "Country and western" — western music is half the name
        ("Western music", "Country music", D),
    ]
    .into_iter()
    .map(|(source, target, ty)| {
        (
            GenreName(source.to_string()),
            GenreName(target.to_string()),
            ty,
        )
    })
    .collect()
}
