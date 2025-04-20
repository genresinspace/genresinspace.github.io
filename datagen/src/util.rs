//! Utility functions used throughout the program.

/// Extracts the domain from a URL.
pub fn extract_domain(url: &str) -> Option<&str> {
    let domain_start = url.find("://")? + 3;
    let domain_end = url[domain_start..].find('/')?;
    Some(&url[domain_start..domain_start + domain_end])
}

/// Parse a Wikipedia dump filename to extract the date as a Jiff civil date.
///
/// Takes a filename like "enwiki-20250123-pages-articles-multistream" and returns
/// the Jiff civil date for (2025, 01, 23).
/// Returns None if the filename doesn't match the expected format.
pub fn parse_wiki_dump_date(filename: &str) -> Option<jiff::civil::Date> {
    // Extract just the date portion (20250123)
    let date_str = filename.strip_prefix("enwiki-")?.split('-').next()?;

    if date_str.len() != 8 {
        return None;
    }

    // Parse year, month, day
    let year = date_str[0..4].parse().ok()?;
    let month = date_str[4..6].parse().ok()?;
    let day = date_str[6..8].parse().ok()?;

    Some(jiff::civil::date(year, month, day))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_wiki_domain() {
        assert_eq!(
            extract_domain("https://en.wikipedia.org/wiki/Main_Page"),
            Some("en.wikipedia.org")
        );
        assert_eq!(
            extract_domain("http://en.wikipedia.org/something"),
            Some("en.wikipedia.org")
        );
        assert_eq!(extract_domain("not a url"), None);
        assert_eq!(extract_domain("https://bad"), None);
        assert_eq!(extract_domain(""), None);
    }

    #[test]
    fn test_parse_wiki_dump_date() {
        assert_eq!(
            parse_wiki_dump_date("enwiki-20250123-pages-articles-multistream"),
            Some(jiff::civil::date(2025, 1, 23))
        );
        assert_eq!(parse_wiki_dump_date("invalid"), None);
    }
}
