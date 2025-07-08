use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
/// A newtype for a Wikipedia page name.
pub struct PageName {
    /// The name of the page.
    pub name: String,
    /// The heading of the page, if any.
    pub heading: Option<String>,
}

/// Character substitutions for making page names safe for Windows filenames.
/// Each tuple contains (original_char, safe_replacement).
const FILENAME_SUBSTITUTIONS: &[(&str, &str)] = &[
    ("/", "⧸"),  // BIG SOLIDUS
    ("\\", "⧵"), // REVERSE SOLIDUS OPERATOR
    (":", "∶"),  // RATIO
    ("*", "✱"),  // HEAVY ASTERISK
    ("?", "？"), // FULLWIDTH QUESTION MARK
    ("\"", "❞"), // HEAVY DOUBLE TURNED COMMA QUOTATION MARK ORNAMENT
    ("<", "❮"),  // HEAVY LEFT-POINTING ANGLE QUOTATION MARK ORNAMENT
    (">", "❯"),  // HEAVY RIGHT-POINTING ANGLE QUOTATION MARK ORNAMENT
    ("|", "❘"),  // LIGHT VERTICAL BAR
];

impl PageName {
    /// Create a new page name.
    pub fn new(name: impl Into<String>, heading: impl Into<Option<String>>) -> Self {
        Self {
            name: name.into(),
            heading: heading.into(),
        }
    }

    /// Set the heading of the page (for cases where the genre box is under a heading, not the root of the page)
    pub fn with_opt_heading(&self, heading: Option<String>) -> Self {
        Self {
            name: self.name.clone(),
            heading,
        }
    }

    /// Creates a variant of the page name that can be used for a link.
    pub fn linksafe(&self) -> Self {
        Self {
            name: self.name.replace(' ', "_"),
            heading: self.heading.clone(),
        }
    }

    /// Makes a Wikipedia page name safe to store on disk.
    pub fn sanitize(&self) -> String {
        // We use Unicode characters that look similar but are safe for Windows filenames
        let mut output = self.name.clone();
        if let Some(heading) = &self.heading {
            output.push_str(&format!("#{heading}"));
        }

        for (original, replacement) in FILENAME_SUBSTITUTIONS {
            output = output.replace(original, replacement);
        }
        output
    }

    /// Reverses [`Self::sanitize`].
    pub fn unsanitize(title: &str) -> PageName {
        let mut output = title.to_string();
        for (original, replacement) in FILENAME_SUBSTITUTIONS {
            output = output.replace(replacement, original);
        }

        if let Some((name, heading)) = output.split_once('#') {
            PageName {
                name: name.to_string(),
                heading: Some(heading.to_string()),
            }
        } else {
            PageName {
                name: output,
                heading: None,
            }
        }
    }
}
impl std::fmt::Display for PageName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)?;
        if let Some(heading) = &self.heading {
            write!(f, "#{heading}")?;
        }
        Ok(())
    }
}
impl Serialize for PageName {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match &self.heading {
            Some(heading) => serializer.serialize_str(&format!("{}#{}", self.name, heading)),
            None => serializer.serialize_str(&self.name),
        }
    }
}
impl<'de> Deserialize<'de> for PageName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        Ok(String::deserialize(deserializer)?.parse().unwrap())
    }
}
impl FromStr for PageName {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.split_once('#') {
            Some((name, heading)) => PageName {
                name: name.to_string(),
                heading: Some(heading.to_string()),
            },
            None => PageName {
                name: s.to_string(),
                heading: None,
            },
        })
    }
}
