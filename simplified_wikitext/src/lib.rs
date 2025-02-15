#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use parse_wiki_text_2 as pwt;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(tag = "type"))]
pub enum SimplifiedWikitextNode {
    #[cfg_attr(feature = "serde", serde(rename = "fragment"))]
    Fragment {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "template"))]
    Template {
        name: String,
        children: Vec<TemplateParameter>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "link"))]
    Link {
        text: String,
        title: String,
        /// Temporary hack: store the genre ID, if any, for this link
        /// We will do this mapping on the client later
        #[serde(skip_serializing_if = "Option::is_none")]
        genre_id: Option<String>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "ext-link"))]
    ExtLink { text: String, link: String },
    #[cfg_attr(feature = "serde", serde(rename = "bold"))]
    Bold {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "italic"))]
    Italic {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "blockquote"))]
    Blockquote {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "superscript"))]
    Superscript {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "subscript"))]
    Subscript {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "small"))]
    Small {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "preformatted"))]
    Preformatted {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "text"))]
    Text { text: String },
    #[cfg_attr(feature = "serde", serde(rename = "paragraph_break"))]
    ParagraphBreak,
    #[cfg_attr(feature = "serde", serde(rename = "newline"))]
    Newline,
}
impl SimplifiedWikitextNode {
    pub fn children(&self) -> Option<&[SimplifiedWikitextNode]> {
        match self {
            Self::Fragment { children } => Some(children),
            Self::Bold { children } => Some(children),
            Self::Italic { children } => Some(children),
            Self::Blockquote { children } => Some(children),
            Self::Superscript { children } => Some(children),
            Self::Subscript { children } => Some(children),
            Self::Small { children } => Some(children),
            Self::Preformatted { children } => Some(children),
            _ => None,
        }
    }
    pub fn children_mut(&mut self) -> Option<&mut Vec<SimplifiedWikitextNode>> {
        match self {
            Self::Fragment { children } => Some(children),
            Self::Bold { children } => Some(children),
            Self::Italic { children } => Some(children),
            Self::Blockquote { children } => Some(children),
            Self::Superscript { children } => Some(children),
            Self::Subscript { children } => Some(children),
            Self::Small { children } => Some(children),
            Self::Preformatted { children } => Some(children),
            _ => None,
        }
    }
    pub fn visit_mut(&mut self, visitor: &mut impl FnMut(&mut Self)) {
        visitor(self);
        if let Some(children) = self.children_mut() {
            for child in children {
                child.visit_mut(visitor);
            }
        }
    }
}
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(tag = "type"))]
#[cfg_attr(feature = "serde", serde(rename = "parameter"))]
pub struct TemplateParameter {
    pub name: String,
    pub value: String,
}

pub fn simplify_wikitext_nodes(wikitext: &str, nodes: &[pwt::Node]) -> Vec<SimplifiedWikitextNode> {
    use SimplifiedWikitextNode as SWN;
    struct RootStack {
        stack: Vec<SWN>,
    }
    impl RootStack {
        fn new() -> Self {
            Self {
                stack: vec![SWN::Fragment { children: vec![] }],
            }
        }
        fn push_layer(&mut self, node: SWN) {
            self.stack.push(node);
        }
        fn pop_layer(&mut self) -> SWN {
            self.stack.pop().unwrap()
        }
        fn last_layer(&self) -> &SWN {
            self.stack.last().unwrap()
        }
        fn add_to_children(&mut self, node: SWN) {
            self.stack
                .last_mut()
                .unwrap()
                .children_mut()
                .unwrap()
                .push(node);
        }
        fn unwind(mut self) -> Vec<SWN> {
            // This is a disgusting hack, but Wikipedia implicitly closes these, so we need to as well...
            while self.stack.len() > 1 {
                let popped = self.pop_layer();
                self.add_to_children(popped);
            }
            self.stack[0].children().unwrap().to_vec()
        }
    }
    let mut root_stack = RootStack::new();

    for node in nodes {
        match node {
            pwt::Node::Bold { .. } => {
                if matches!(root_stack.last_layer(), SWN::Bold { .. }) {
                    let bold = root_stack.pop_layer();
                    root_stack.add_to_children(bold);
                } else {
                    root_stack.push_layer(SWN::Bold { children: vec![] });
                }
            }
            pwt::Node::Italic { .. } => {
                if matches!(root_stack.last_layer(), SWN::Italic { .. }) {
                    let italic = root_stack.pop_layer();
                    root_stack.add_to_children(italic);
                } else {
                    root_stack.push_layer(SWN::Italic { children: vec![] });
                }
            }
            pwt::Node::BoldItalic { .. } => {
                if matches!(root_stack.last_layer(), SWN::Italic { .. }) {
                    let italic = root_stack.pop_layer();
                    if matches!(root_stack.last_layer(), SWN::Bold { .. }) {
                        let mut bold = root_stack.pop_layer();
                        bold.children_mut().unwrap().push(italic);
                        root_stack.add_to_children(bold);
                    } else {
                        panic!("BoldItalic found without a bold layer");
                    }
                } else {
                    root_stack.push_layer(SWN::Bold { children: vec![] });
                    root_stack.push_layer(SWN::Italic { children: vec![] });
                }
            }
            pwt::Node::StartTag { name, .. } if name == "blockquote" => {
                root_stack.push_layer(SWN::Blockquote { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "blockquote" => {
                let blockquote = root_stack.pop_layer();
                root_stack.add_to_children(blockquote);
            }
            pwt::Node::StartTag { name, .. } if name == "sup" => {
                root_stack.push_layer(SWN::Superscript { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "sup" => {
                let superscript = root_stack.pop_layer();
                root_stack.add_to_children(superscript);
            }
            pwt::Node::StartTag { name, .. } if name == "sub" => {
                root_stack.push_layer(SWN::Subscript { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "sub" => {
                let subscript = root_stack.pop_layer();
                root_stack.add_to_children(subscript);
            }
            pwt::Node::StartTag { name, .. } if name == "small" => {
                root_stack.push_layer(SWN::Small { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "small" => {
                let small = root_stack.pop_layer();
                root_stack.add_to_children(small);
            }
            other => {
                if let Some(simplified_node) = simplify_wikitext_node(wikitext, other) {
                    root_stack.add_to_children(simplified_node);
                }
            }
        }
    }

    root_stack.unwind()
}

pub fn simplify_wikitext_node(wikitext: &str, node: &pwt::Node) -> Option<SimplifiedWikitextNode> {
    use SimplifiedWikitextNode as SWN;
    match node {
        pwt::Node::Template {
            name, parameters, ..
        } => {
            let mut unnamed_parameter_index = 1;
            let mut children = vec![];
            for parameter in parameters {
                let name = if let Some(parameter_name) = &parameter.name {
                    nodes_inner_text(parameter_name, &InnerTextConfig::default())
                } else {
                    let name = unnamed_parameter_index.to_string();
                    unnamed_parameter_index += 1;
                    name
                };

                let value_start = parameter
                    .value
                    .first()
                    .map(|v| NodeMetadata::for_node(v).start)
                    .unwrap_or_default();
                let value_end = parameter
                    .value
                    .last()
                    .map(|v| NodeMetadata::for_node(v).end)
                    .unwrap_or_default();
                let value = wikitext[value_start..value_end].to_string();

                children.push(TemplateParameter { name, value });
            }

            return Some(SWN::Template {
                name: nodes_inner_text(name, &InnerTextConfig::default()),
                children,
            });
        }
        pwt::Node::MagicWord { .. } => {
            // Making the current assumption that we don't care about these
            return None;
        }
        pwt::Node::Bold { .. } | pwt::Node::BoldItalic { .. } | pwt::Node::Italic { .. } => {
            // We can't do anything at this level
            return None;
        }
        pwt::Node::Link { target, text, .. } => {
            return Some(SWN::Link {
                text: nodes_inner_text(text, &InnerTextConfig::default()),
                title: target.to_string(),
                genre_id: None,
            });
        }
        pwt::Node::ExternalLink { nodes, .. } => {
            let inner = nodes_inner_text(nodes, &InnerTextConfig::default());
            let (text, link) = inner.split_once(' ').unwrap_or(("link", &inner));
            return Some(SWN::ExtLink {
                text: text.to_string(),
                link: link.to_string(),
            });
        }
        pwt::Node::Text { value, .. } => {
            return Some(SWN::Text {
                text: value.to_string(),
            });
        }
        pwt::Node::CharacterEntity { character, .. } => {
            return Some(SWN::Text {
                text: character.to_string(),
            });
        }
        pwt::Node::ParagraphBreak { .. } => {
            return Some(SWN::ParagraphBreak);
        }
        pwt::Node::Category { .. } | pwt::Node::Comment { .. } | pwt::Node::Image { .. } => {
            // Don't care
            return None;
        }
        pwt::Node::DefinitionList { .. }
        | pwt::Node::OrderedList { .. }
        | pwt::Node::UnorderedList { .. } => {
            // Temporarily ignore these
            return None;
        }
        pwt::Node::Tag { name, .. }
            if ["nowiki", "references", "gallery"].contains(&name.as_ref()) =>
        {
            // Don't care
            return None;
        }
        pwt::Node::StartTag { name, .. } if name == "br" => {
            return Some(SWN::Newline);
        }
        pwt::Node::Preformatted { nodes, .. } => {
            return Some(SWN::Preformatted {
                children: simplify_wikitext_nodes(wikitext, nodes),
            });
        }
        _ => {}
    }
    let metadata = NodeMetadata::for_node(node);
    panic!(
        "Unknown node type: {:?}: {:?}",
        node,
        &wikitext[metadata.start..metadata.end]
    );
}

pub struct NodeMetadata<'a> {
    pub name: &'static str,
    pub start: usize,
    pub end: usize,
    pub children: Option<&'a [pwt::Node<'a>]>,
}
impl<'a> NodeMetadata<'a> {
    fn new(
        name: &'static str,
        start: usize,
        end: usize,
        children: Option<&'a [pwt::Node<'a>]>,
    ) -> Self {
        Self {
            name,
            start,
            end,
            children,
        }
    }

    pub fn for_node(node: &'a pwt::Node) -> NodeMetadata<'a> {
        use NodeMetadata as NM;
        match node {
            pwt::Node::Bold { end, start } => NM::new("bold", *start, *end, None),
            pwt::Node::BoldItalic { end, start } => NM::new("bold_italic", *start, *end, None),
            pwt::Node::Category { end, start, .. } => NM::new("category", *start, *end, None),
            pwt::Node::CharacterEntity { end, start, .. } => {
                NM::new("character_entity", *start, *end, None)
            }
            pwt::Node::Comment { end, start } => NM::new("comment", *start, *end, None),
            pwt::Node::DefinitionList {
                end,
                start,
                items: _,
            } => NM::new("definition_list", *start, *end, None),
            pwt::Node::EndTag { end, start, .. } => NM::new("end_tag", *start, *end, None),
            pwt::Node::ExternalLink { end, nodes, start } => {
                NM::new("external_link", *start, *end, Some(nodes))
            }
            pwt::Node::Heading {
                end, start, nodes, ..
            } => NM::new("heading", *start, *end, Some(nodes)),
            pwt::Node::HorizontalDivider { end, start } => {
                NM::new("horizontal_divider", *start, *end, None)
            }
            pwt::Node::Image {
                end, start, text, ..
            } => NM::new("image", *start, *end, Some(text)),
            pwt::Node::Italic { end, start } => NM::new("italic", *start, *end, None),
            pwt::Node::Link {
                end, start, text, ..
            } => NM::new("link", *start, *end, Some(text)),
            pwt::Node::MagicWord { end, start } => NM::new("magic_word", *start, *end, None),
            pwt::Node::OrderedList {
                end,
                start,
                items: _,
            } => NM::new("ordered_list", *start, *end, None),
            pwt::Node::ParagraphBreak { end, start } => {
                NM::new("paragraph_break", *start, *end, None)
            }
            pwt::Node::Parameter { end, start, .. } => NM::new("parameter", *start, *end, None),
            pwt::Node::Preformatted { end, start, nodes } => {
                NM::new("preformatted", *start, *end, Some(nodes))
            }
            pwt::Node::Redirect { end, start, .. } => NM::new("redirect", *start, *end, None),
            pwt::Node::StartTag { end, start, .. } => NM::new("start_tag", *start, *end, None),
            pwt::Node::Table {
                end,
                start,
                rows: _,
                ..
            } => NM::new("table", *start, *end, None),
            pwt::Node::Tag {
                end, start, nodes, ..
            } => NM::new("tag", *start, *end, Some(nodes.as_slice())),
            pwt::Node::Template { end, start, .. } => NM::new("template", *start, *end, None),
            pwt::Node::Text { end, start, .. } => NM::new("text", *start, *end, None),
            pwt::Node::UnorderedList {
                end,
                start,
                items: _,
            } => NM::new("unordered_list", *start, *end, None),
        }
    }
}

#[derive(Default)]
pub struct InnerTextConfig {
    /// Whether to stop after a `<br>` tag.
    pub stop_after_br: bool,
}
/// Joins nodes together without any space between them and trims the result, which is not always the correct behaviour
pub fn nodes_inner_text(nodes: &[pwt::Node], config: &InnerTextConfig) -> String {
    let mut result = String::new();
    for node in nodes {
        if config.stop_after_br && matches!(node, pwt::Node::StartTag { name, .. } if name == "br")
        {
            break;
        }
        result.push_str(&node_inner_text(node, config));
    }
    result.trim().to_string()
}

/// Just gets the inner text without any formatting, which is not always the correct behaviour
///
/// This function is allocation-heavy; there's definitely room for optimisation here, but it's
/// not a huge issue right now
pub fn node_inner_text(node: &pwt::Node, config: &InnerTextConfig) -> String {
    use pwt::Node;
    match node {
        Node::CharacterEntity { character, .. } => character.to_string(),
        // Node::DefinitionList { end, items, start } => nodes_inner_text(items, config),
        Node::Heading { nodes, .. } => nodes_inner_text(nodes, config),
        Node::Image { text, .. } => nodes_inner_text(text, config),
        Node::Link { text, .. } => nodes_inner_text(text, config),
        // Node::OrderedList { end, items, start } => nodes_inner_text(items, config),
        Node::Preformatted { nodes, .. } => nodes_inner_text(nodes, config),
        Node::Text { value, .. } => value.to_string(),
        // Node::UnorderedList { end, items, start } => nodes_inner_text(items, config),
        Node::Template {
            name, parameters, ..
        } => {
            let name = nodes_inner_text(name, config).to_ascii_lowercase();

            if name == "lang" {
                // hack: extract the text from the other-language template
                // the parameter is `|text=`, or the second paramter, so scan for both
                parameters
                    .iter()
                    .find(|p| {
                        p.name
                            .as_ref()
                            .is_some_and(|n| nodes_inner_text(n, config) == "text")
                    })
                    .or_else(|| parameters.iter().filter(|p| p.name.is_none()).nth(1))
                    .map(|p| nodes_inner_text(&p.value, config))
                    .unwrap_or_default()
            } else if name == "transliteration" || name == "tlit" || name == "transl" {
                // text is either the second or the third positional argument;
                // in the case of the latter, the second argument is the transliteration scheme,
                // so we want to select for the third first before the second

                let positional_args = parameters
                    .iter()
                    .filter(|p| p.name.is_none())
                    .collect::<Vec<_>>();
                if positional_args.len() >= 3 {
                    nodes_inner_text(&positional_args[2].value, config)
                } else {
                    nodes_inner_text(&positional_args[1].value, config)
                }
            } else {
                "".to_string()
            }
        }
        _ => "".to_string(),
    }
}

pub fn pwt_configuration() -> pwt::Configuration {
    pwt::Configuration::new(&pwt::ConfigurationSource {
        category_namespaces: &["category"],
        extension_tags: &[
            "categorytree",
            "ce",
            "charinsert",
            "chem",
            "gallery",
            "graph",
            "hiero",
            "imagemap",
            "indicator",
            "inputbox",
            "langconvert",
            "mapframe",
            "maplink",
            "math",
            "nowiki",
            "poem",
            "pre",
            "ref",
            "references",
            "score",
            "section",
            "source",
            "syntaxhighlight",
            "templatedata",
            "templatestyles",
            "timeline",
        ],
        file_namespaces: &["file", "image"],
        link_trail: "abcdefghijklmnopqrstuvwxyz",
        magic_words: &[
            "disambig",
            "expected_unconnected_page",
            "expectunusedcategory",
            "forcetoc",
            "hiddencat",
            "index",
            "newsectionlink",
            "nocc",
            "nocontentconvert",
            "noeditsection",
            "nogallery",
            "noglobal",
            "noindex",
            "nonewsectionlink",
            "notc",
            "notitleconvert",
            "notoc",
            "staticredirect",
            "toc",
        ],
        protocols: &[
            "//",
            "bitcoin:",
            "ftp://",
            "ftps://",
            "geo:",
            "git://",
            "gopher://",
            "http://",
            "https://",
            "irc://",
            "ircs://",
            "magnet:",
            "mailto:",
            "mms://",
            "news:",
            "nntp://",
            "redis://",
            "sftp://",
            "sip:",
            "sips:",
            "sms:",
            "ssh://",
            "svn://",
            "tel:",
            "telnet://",
            "urn:",
            "worldwind://",
            "xmpp:",
        ],
        redirect_magic_words: &["redirect"],
    })
}
