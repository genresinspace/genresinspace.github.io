//! Reads the compressed Wikipedia links dump SQL to extract the number of links to each page we track.

use std::{
    collections::BTreeMap,
    io::Read as _,
    path::{Path, PathBuf},
};

use anyhow::Context as _;

use crate::types;

pub(crate) fn read(
    start: std::time::Instant,
    wikipedia_linktargets_path: &Path,
    wikipedia_links_path: &Path,
    page_names: &BTreeMap<types::PageName, PathBuf>,
    output_path: &Path,
) -> anyhow::Result<BTreeMap<types::PageName, usize>> {
    let output_file_path = output_path.join("artist_inbound_link_counts.json");
    if output_file_path.is_file() {
        return serde_json::from_str(&std::fs::read_to_string(&output_file_path).with_context(
            || {
                format!(
                    "Failed to read existing link counts file: {}",
                    output_file_path.display()
                )
            },
        )?)
        .with_context(|| {
            format!(
                "Failed to parse JSON from existing link counts file: {}",
                output_file_path.display()
            )
        });
    }

    let linktargets = linktargets::read(start, wikipedia_linktargets_path, page_names, output_path)
        .with_context(|| {
            format!(
                "Failed to read linktargets from: {}",
                wikipedia_linktargets_path.display()
            )
        })?;

    links::read(
        start,
        wikipedia_links_path,
        &linktargets,
        page_names,
        &output_file_path,
    )
    .with_context(|| {
        format!(
            "Failed to read links from: {}",
            wikipedia_links_path.display()
        )
    })
}

mod common {
    use anyhow::Context as _;

    pub fn skip_until_prefix(
        stream: &mut impl std::io::Read,
        target_prefix: &[u8],
    ) -> anyhow::Result<()> {
        // Skip bytes until we find the  prefix
        let mut buffer = vec![0u8; target_prefix.len()];
        let mut buffer_pos = 0;
        let mut byte = [0u8; 1];

        loop {
            if stream.read(&mut byte).with_context(|| {
                format!(
                    "Failed to read byte while searching for prefix: {:?}",
                    String::from_utf8_lossy(target_prefix)
                )
            })? == 0
            {
                // End of file reached without finding the INSERT statement
                panic!("End of file reached without finding the INSERT statement");
            }

            // Add byte to circular buffer
            buffer[buffer_pos] = byte[0];
            buffer_pos = (buffer_pos + 1) % buffer.len();

            // Check if buffer matches our target prefix
            let mut matches = true;
            for (i, &expected_byte) in target_prefix.iter().enumerate() {
                let buf_idx = (buffer_pos + i) % buffer.len();
                if buffer[buf_idx] != expected_byte {
                    matches = false;
                    break;
                }
            }

            if matches {
                // Found the  prefix, ready for parsing
                break;
            }
        }

        Ok(())
    }

    pub fn parse_digit(number: u64, c: char) -> u64 {
        number * 10 + (c as u64 - '0' as u64)
    }
}

mod linktargets {
    use super::*;
    use common::parse_digit;

    pub(crate) fn read(
        start: std::time::Instant,
        wikipedia_linktargets_path: &Path,
        page_names: &BTreeMap<types::PageName, PathBuf>,
        output_path: &Path,
    ) -> anyhow::Result<BTreeMap<u64, types::PageName>> {
        let output_file_path = output_path.join("linktargets.json");
        if output_file_path.is_file() {
            return serde_json::from_str(
                &std::fs::read_to_string(&output_file_path).with_context(|| {
                    format!(
                        "Failed to read existing linktargets file: {}",
                        output_file_path.display()
                    )
                })?,
            )
            .with_context(|| {
                format!(
                    "Failed to parse JSON from existing linktargets file: {}",
                    output_file_path.display()
                )
            });
        }

        println!("{:.2}s: reading linktargets", start.elapsed().as_secs_f32());

        let linktargets_file =
            std::fs::File::open(wikipedia_linktargets_path).with_context(|| {
                format!(
                    "Failed to open Wikipedia linktargets file: {}",
                    wikipedia_linktargets_path.display()
                )
            })?;

        let mut linktargets_file = std::io::BufReader::new(flate2::bufread::GzDecoder::new(
            std::io::BufReader::new(linktargets_file),
        ));

        common::skip_until_prefix(&mut linktargets_file, b"INSERT INTO `linktarget` VALUES ")
            .context(
                "Failed to find INSERT INTO `linktarget` VALUES statement in linktargets file",
            )?;

        let mut linktargets: BTreeMap<u64, types::PageName> = BTreeMap::new();

        parse_linktarget_tuple_stream(&mut linktargets_file, start, page_names, &mut linktargets)
            .context("Failed to parse linktarget tuples from stream")?;

        std::fs::write(
            &output_file_path,
            serde_json::to_string_pretty(&linktargets)
                .context("Failed to serialize linktargets to JSON")?,
        )
        .with_context(|| {
            format!(
                "Failed to write linktargets to file: {}",
                output_file_path.display()
            )
        })?;

        Ok(linktargets)
    }

    fn parse_linktarget_tuple_stream(
        stream: &mut impl std::io::BufRead,
        start: std::time::Instant,
        page_names: &BTreeMap<types::PageName, PathBuf>,
        output: &mut BTreeMap<u64, types::PageName>,
    ) -> anyhow::Result<()> {
        enum ParseState {
            SearchingForTupleStart,
            LtId {
                lt_id: u64,
            },
            LtNamespace {
                lt_id: u64,
                lt_namespace: i64,
                is_negative: bool,
            },
            LtTitleStart {
                lt_id: u64,
                lt_namespace: i64,
            },
            LtTitle {
                lt_id: u64,
                lt_namespace: i64,
                lt_title: String,
            },
            LtTitleEscape {
                lt_id: u64,
                lt_namespace: i64,
                lt_title: String,
            },
            WaitingForTupleEnd {
                lt_id: u64,
                lt_namespace: i64,
                lt_title: String,
            },
        }

        let mut state = ParseState::SearchingForTupleStart;
        let mut tuples_parsed = 0;

        // Read the rest of the file byte by byte
        for byte in stream.bytes() {
            let byte = byte.context("Failed to read byte from linktargets file")?;
            let c = byte as char;

            state = match state {
                ParseState::SearchingForTupleStart => {
                    if c == '(' {
                        ParseState::LtId { lt_id: 0 }
                    } else {
                        ParseState::SearchingForTupleStart
                    }
                }
                ParseState::LtId { lt_id } => {
                    if c.is_ascii_digit() {
                        ParseState::LtId {
                            lt_id: parse_digit(lt_id, c),
                        }
                    } else if c == ',' {
                        ParseState::LtNamespace {
                            lt_id,
                            lt_namespace: 0,
                            is_negative: false,
                        }
                    } else {
                        unreachable!()
                    }
                }
                ParseState::LtNamespace {
                    lt_id,
                    lt_namespace,
                    is_negative,
                } => {
                    if c.is_ascii_digit() {
                        ParseState::LtNamespace {
                            lt_id,
                            lt_namespace: parse_digit(lt_namespace as u64, c) as i64,
                            is_negative,
                        }
                    } else if c == '-' && lt_namespace == 0 {
                        ParseState::LtNamespace {
                            lt_id,
                            lt_namespace: 0,
                            is_negative: true,
                        }
                    } else if c == ',' {
                        let final_namespace = if is_negative {
                            -lt_namespace
                        } else {
                            lt_namespace
                        };
                        ParseState::LtTitleStart {
                            lt_id,
                            lt_namespace: final_namespace,
                        }
                    } else {
                        unreachable!()
                    }
                }
                ParseState::LtTitleStart {
                    lt_id,
                    lt_namespace,
                } => {
                    if c == '\'' {
                        ParseState::LtTitle {
                            lt_id,
                            lt_namespace,
                            lt_title: String::new(),
                        }
                    } else {
                        unreachable!()
                    }
                }
                ParseState::LtTitle {
                    lt_id,
                    lt_namespace,
                    mut lt_title,
                } => {
                    if c == '\'' {
                        ParseState::WaitingForTupleEnd {
                            lt_id,
                            lt_namespace,
                            lt_title,
                        }
                    } else if c == '\\' {
                        ParseState::LtTitleEscape {
                            lt_id,
                            lt_namespace,
                            lt_title,
                        }
                    } else {
                        // Convert underscores to spaces during parsing
                        let char_to_add = if c == '_' { ' ' } else { c };
                        lt_title.push(char_to_add);
                        ParseState::LtTitle {
                            lt_id,
                            lt_namespace,
                            lt_title,
                        }
                    }
                }
                ParseState::LtTitleEscape {
                    lt_id,
                    lt_namespace,
                    mut lt_title,
                } => {
                    // Add the escaped character as-is (don't convert underscores in escaped chars)
                    lt_title.push(c);
                    ParseState::LtTitle {
                        lt_id,
                        lt_namespace,
                        lt_title,
                    }
                }
                ParseState::WaitingForTupleEnd {
                    lt_id,
                    lt_namespace,
                    lt_title,
                } => {
                    if c == ')' {
                        // Only process tuples with namespace 0
                        if lt_namespace == 0 {
                            let page_name = types::PageName::new(&lt_title, None);
                            if page_names.contains_key(&page_name) {
                                output.insert(lt_id, page_name);
                            }
                        }

                        tuples_parsed += 1;
                        if tuples_parsed % 10_000_000 == 0 {
                            println!(
                                "{:.2}s: parsed {tuples_parsed} linktarget tuples",
                                start.elapsed().as_secs_f32(),
                            );
                        }

                        ParseState::SearchingForTupleStart
                    } else {
                        // Continue waiting for tuple end
                        ParseState::WaitingForTupleEnd {
                            lt_id,
                            lt_namespace,
                            lt_title,
                        }
                    }
                }
            }
        }

        println!(
            "{:.2}s: parsed {tuples_parsed} linktarget tuples",
            start.elapsed().as_secs_f32(),
        );

        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{io::Cursor, sync::LazyLock};

        fn pn(name: &str) -> types::PageName {
            types::PageName::new(name, None)
        }

        static PAGE_NAMES: LazyLock<BTreeMap<types::PageName, PathBuf>> = LazyLock::new(|| {
            let mut map = BTreeMap::new();
            map.insert(pn("Example Page"), PathBuf::from("example_page"));
            map.insert(pn("Another Example"), PathBuf::from("another_example"));
            map.insert(pn("Test Article"), PathBuf::from("test_article"));
            map
        });

        #[test]
        fn test_parse_simple_linktarget_tuple() {
            let mut output = BTreeMap::new();
            let data = "(123,0,'Example_Page')";
            let mut stream = Cursor::new(data.as_bytes());
            parse_linktarget_tuple_stream(
                &mut stream,
                std::time::Instant::now(),
                &PAGE_NAMES,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&123), Some(&pn("Example Page")));
        }

        #[test]
        fn test_parse_multiple_linktarget_tuples() {
            let mut output = BTreeMap::new();
            let data = "(123,0,'Example_Page'),(456,0,'Another_Example'),(789,0,'Test_Article');";
            let mut stream = Cursor::new(data.as_bytes());
            parse_linktarget_tuple_stream(
                &mut stream,
                std::time::Instant::now(),
                &PAGE_NAMES,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&123), Some(&pn("Example Page")));
            assert_eq!(output.get(&456), Some(&pn("Another Example")));
            assert_eq!(output.get(&789), Some(&pn("Test Article")));
        }

        #[test]
        fn test_parse_linktarget_tuples_with_untracked_pages() {
            let mut output = BTreeMap::new();
            let data = "(123,0,'Example_Page'),(456,0,'Untracked_Page'),(789,0,'Test_Article');";
            let mut stream = Cursor::new(data.as_bytes());
            parse_linktarget_tuple_stream(
                &mut stream,
                std::time::Instant::now(),
                &PAGE_NAMES,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&123), Some(&pn("Example Page")));
            assert_eq!(output.get(&456), None); // Untracked page should not be included
            assert_eq!(output.get(&789), Some(&pn("Test Article")));
        }

        #[test]
        fn test_parse_linktarget_tuples_with_non_zero_namespace() {
            let mut output = BTreeMap::new();
            let data = "(123,0,'Example_Page'),(456,1,'Another_Example'),(789,-1,'Test_Article');";
            let mut stream = Cursor::new(data.as_bytes());
            parse_linktarget_tuple_stream(
                &mut stream,
                std::time::Instant::now(),
                &PAGE_NAMES,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&123), Some(&pn("Example Page")));
            assert_eq!(output.get(&456), None); // Namespace 1 should be ignored
            assert_eq!(output.get(&789), None); // Namespace -1 should be ignored
        }

        #[test]
        fn test_parse_linktarget_with_negative_namespace() {
            let mut output = BTreeMap::new();
            let data = "(123,-2,'Example_Page')";
            let mut stream = Cursor::new(data.as_bytes());
            parse_linktarget_tuple_stream(
                &mut stream,
                std::time::Instant::now(),
                &PAGE_NAMES,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&123), None); // Negative namespace should be ignored
        }

        #[test]
        fn test_parse_linktarget_with_escaped_characters() {
            let mut page_names = BTreeMap::new();
            page_names.insert(pn("Example'Page"), PathBuf::from("example_page"));

            let mut output = BTreeMap::new();
            let data = "(123,0,'Example\\'Page')";
            let mut stream = Cursor::new(data.as_bytes());
            parse_linktarget_tuple_stream(
                &mut stream,
                std::time::Instant::now(),
                &page_names,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&123), Some(&pn("Example'Page")));
        }
    }
}

mod links {
    use super::*;
    use common::parse_digit;

    pub(crate) fn read(
        start: std::time::Instant,
        wikipedia_links_path: &Path,
        linktargets: &BTreeMap<u64, types::PageName>,
        page_names: &BTreeMap<types::PageName, PathBuf>,
        output_file_path: &Path,
    ) -> anyhow::Result<BTreeMap<types::PageName, usize>> {
        println!(
            "{:.2}s: generating page inbound link counts",
            start.elapsed().as_secs_f32()
        );

        let links_file = std::fs::File::open(wikipedia_links_path)
            .context("Failed to open Wikipedia links file")?;
        let mut links_file = std::io::BufReader::new(flate2::bufread::GzDecoder::new(
            std::io::BufReader::new(links_file),
        ));

        common::skip_until_prefix(&mut links_file, b"INSERT INTO `pagelinks` VALUES ")
            .context("Failed to find INSERT INTO `pagelinks` VALUES statement in links file")?;

        let mut artist_inbound_link_counts: BTreeMap<types::PageName, usize> =
            page_names.keys().map(|id| (id.clone(), 0)).collect();

        parse_tuple_byte_stream(
            &mut links_file,
            start,
            linktargets,
            &mut artist_inbound_link_counts,
        )
        .context("Failed to parse pagelinks tuples from stream")?;

        std::fs::write(
            output_file_path,
            serde_json::to_string_pretty(&artist_inbound_link_counts)
                .context("Failed to serialize artist inbound link counts to JSON")?,
        )
        .with_context(|| {
            format!(
                "Failed to write artist inbound link counts to file: {}",
                output_file_path.display()
            )
        })?;

        Ok(artist_inbound_link_counts)
    }

    fn parse_tuple_byte_stream(
        stream: &mut impl std::io::BufRead,
        start: std::time::Instant,
        linktargets: &BTreeMap<u64, types::PageName>,
        output: &mut BTreeMap<types::PageName, usize>,
    ) -> anyhow::Result<()> {
        enum ParseState {
            SearchingForTupleStart,
            SourceId {
                source_id: u64,
            },
            SourceNamespace {
                source_id: u64,
                source_namespace: u64,
            },
            DestinationId {
                source_id: u64,
                source_namespace: u64,
                destination_id: u64,
            },
        }

        let mut state = ParseState::SearchingForTupleStart;
        let mut tuples_parsed = 0;

        // Read the rest of the file byte by byte
        for byte in stream.bytes() {
            let byte = byte.context("Failed to read byte from links file")?;
            let c = byte as char;

            state = match state {
                ParseState::SearchingForTupleStart => {
                    if c == '(' {
                        ParseState::SourceId { source_id: 0 }
                    } else {
                        ParseState::SearchingForTupleStart
                    }
                }
                ParseState::SourceId { source_id } => {
                    if c.is_ascii_digit() {
                        ParseState::SourceId {
                            source_id: parse_digit(source_id, c),
                        }
                    } else if c == ',' {
                        ParseState::SourceNamespace {
                            source_id,
                            source_namespace: 0,
                        }
                    } else {
                        unreachable!()
                    }
                }
                ParseState::SourceNamespace {
                    source_id,
                    source_namespace,
                } => {
                    if c.is_ascii_digit() {
                        ParseState::SourceNamespace {
                            source_id,
                            source_namespace: parse_digit(source_namespace, c),
                        }
                    } else if c == ',' {
                        ParseState::DestinationId {
                            source_id,
                            source_namespace,
                            destination_id: 0,
                        }
                    } else {
                        unreachable!()
                    }
                }
                ParseState::DestinationId {
                    source_id,
                    source_namespace,
                    destination_id,
                } => {
                    if c.is_ascii_digit() {
                        ParseState::DestinationId {
                            source_id,
                            source_namespace,
                            destination_id: parse_digit(destination_id, c),
                        }
                    } else if c == ')' {
                        if let Some(count) = linktargets
                            .get(&destination_id)
                            .and_then(|pn| output.get_mut(pn))
                        {
                            *count += 1;
                        }
                        tuples_parsed += 1;
                        if tuples_parsed % 100_000_000 == 0 {
                            println!(
                                "{:.2}s: parsed {tuples_parsed} pagelink tuples",
                                start.elapsed().as_secs_f32(),
                            );
                        }
                        ParseState::SearchingForTupleStart
                    } else {
                        unreachable!()
                    }
                }
            }
        }

        println!(
            "{:.2}s: parsed {tuples_parsed} tuples",
            start.elapsed().as_secs_f32(),
        );

        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{io::Cursor, sync::LazyLock};

        fn pn(name: &str) -> types::PageName {
            types::PageName::new(name, None)
        }

        static LINK_TARGETS: LazyLock<BTreeMap<u64, types::PageName>> = LazyLock::new(|| {
            let mut map = BTreeMap::new();
            map.insert(123, pn("Page 123"));
            map.insert(456, pn("Page 456"));
            map.insert(789, pn("Page 789"));
            map
        });

        #[test]
        fn test_parse_simple_tuple() {
            let mut output = BTreeMap::from_iter([(pn("Page 123"), 0)]);
            let data = "(1,0,123)";
            let mut stream = Cursor::new(data.as_bytes());
            parse_tuple_byte_stream(
                &mut stream,
                std::time::Instant::now(),
                &LINK_TARGETS,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&pn("Page 123")), Some(&1));
        }

        #[test]
        fn test_parse_multiple_tuples_with_extra_data() {
            let mut output = BTreeMap::from_iter([
                (pn("Page 123"), 0),
                (pn("Page 456"), 0),
                (pn("Page 789"), 0),
            ]);
            let data = b"(1,0,123),(2,0,456),(3,0,789);";
            let mut stream = Cursor::new(data);
            parse_tuple_byte_stream(
                &mut stream,
                std::time::Instant::now(),
                &LINK_TARGETS,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&pn("Page 123")), Some(&1));
            assert_eq!(output.get(&pn("Page 456")), Some(&1));
            assert_eq!(output.get(&pn("Page 789")), Some(&1));
        }

        #[test]
        fn test_parse_tuples_with_untracked_pages() {
            let mut output = BTreeMap::from_iter([(pn("Page 123"), 0), (pn("Page 789"), 0)]);
            let data = b"(1,0,123),(2,0,456),(3,0,789);";
            let mut stream = Cursor::new(data);
            parse_tuple_byte_stream(
                &mut stream,
                std::time::Instant::now(),
                &LINK_TARGETS,
                &mut output,
            )
            .unwrap();
            assert_eq!(output.get(&pn("Page 123")), Some(&1));
            assert_eq!(output.get(&pn("Page 456")), None);
            assert_eq!(output.get(&pn("Page 789")), Some(&1));
        }
    }
}
