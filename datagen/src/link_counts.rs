//! Reads the compressed Wikipedia links dump SQL to extract the number of links to each page we track.

use std::{collections::HashMap, io::Read as _, path::Path};

use anyhow::Context as _;

use crate::types;

pub(crate) fn read(
    start: std::time::Instant,
    wikipedia_links_path: &Path,
    id_to_page_names: &HashMap<u64, types::PageName>,
    output_path: &Path,
) -> anyhow::Result<HashMap<types::PageName, usize>> {
    let output_file_path = output_path.join("page_inbound_link_counts.json");
    if output_file_path.is_file() {
        return Ok(serde_json::from_str(&std::fs::read_to_string(
            &output_file_path,
        )?)?);
    }

    println!(
        "{:.2}s: generating page inbound link counts",
        start.elapsed().as_secs_f32()
    );

    let links_file =
        std::fs::File::open(wikipedia_links_path).context("Failed to open Wikipedia links file")?;
    let mut links_file = std::io::BufReader::new(flate2::bufread::GzDecoder::new(
        std::io::BufReader::new(links_file),
    ));

    skip_to_insert_statement(&mut links_file)?;

    let mut page_id_counts: HashMap<u64, usize> =
        id_to_page_names.keys().map(|&id| (id, 0)).collect();

    parse_tuple_byte_stream(&mut links_file, start, &mut page_id_counts)?;

    let page_inbound_link_counts = page_id_counts
        .into_iter()
        .map(|(id, count)| (id_to_page_names[&id].clone(), count))
        .collect();

    std::fs::write(
        output_file_path,
        serde_json::to_string_pretty(&page_inbound_link_counts)?,
    )?;

    Ok(page_inbound_link_counts)
}

fn skip_to_insert_statement(stream: &mut impl std::io::Read) -> anyhow::Result<()> {
    // Skip bytes until we find the INSERT statement prefix
    let target_prefix = b"INSERT INTO `pagelinks` VALUES ";
    let mut buffer = vec![0u8; target_prefix.len()];
    let mut buffer_pos = 0;
    let mut byte = [0u8; 1];

    loop {
        if stream.read(&mut byte)? == 0 {
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
            // Found the INSERT statement prefix, ready for parsing
            break;
        }
    }

    Ok(())
}

fn parse_tuple_byte_stream(
    stream: &mut impl std::io::Read,
    start: std::time::Instant,
    output: &mut HashMap<u64, usize>,
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
                        source_id: source_id,
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
                    if let Some(count) = output.get_mut(&destination_id) {
                        *count += 1;
                    }
                    tuples_parsed += 1;
                    if tuples_parsed % 100_000_000 == 0 {
                        println!(
                            "{:.2}s: parsed {tuples_parsed} tuples",
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

    fn parse_digit(number: u64, c: char) -> u64 {
        number * 10 + (c as u64 - '0' as u64)
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_parse_simple_tuple() {
        let mut output = HashMap::from_iter([(123, 0)]);
        let data = "(1,0,123)";
        let mut stream = Cursor::new(data.as_bytes());
        parse_tuple_byte_stream(&mut stream, std::time::Instant::now(), &mut output).unwrap();
        assert_eq!(output.get(&123), Some(&1));
    }

    #[test]
    fn test_parse_multiple_tuples_with_extra_data() {
        let mut output = HashMap::from_iter([(123, 0), (456, 0), (789, 0)]);
        let data = b"INSERT INTO `pagelinks` VALUES (1,0,123),(2,0,456),(3,0,789);";
        let mut stream = Cursor::new(data);
        // We need to skip the INSERT statement prefix
        let mut buffer = vec![0u8; 29];
        stream.read_exact(&mut buffer).unwrap();
        parse_tuple_byte_stream(&mut stream, std::time::Instant::now(), &mut output).unwrap();
        assert_eq!(output.get(&123), Some(&1));
        assert_eq!(output.get(&456), Some(&1));
        assert_eq!(output.get(&789), Some(&1));
    }

    #[test]
    fn test_parse_tuples_with_untracked_pages() {
        let mut output = HashMap::from_iter([(123, 0), (789, 0)]);
        let data = b"INSERT INTO `pagelinks` VALUES (1,0,123),(2,0,456),(3,0,789);";
        let mut stream = Cursor::new(data);
        // We need to skip the INSERT statement prefix
        let mut buffer = vec![0u8; 29];
        stream.read_exact(&mut buffer).unwrap();
        parse_tuple_byte_stream(&mut stream, std::time::Instant::now(), &mut output).unwrap();
        assert_eq!(output.get(&123), Some(&1));
        assert_eq!(output.get(&456), None);
        assert_eq!(output.get(&789), Some(&1));
    }
}
