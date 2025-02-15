use std::sync::LazyLock;

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use parse_wiki_text_2 as pwt;
use wikitext_util::{nodes_inner_text, pwt_configuration, InnerTextConfig, NodeMetadata};

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
