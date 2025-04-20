import { JSX, ReactNode } from "react";
import { WikitextSimplifiedNode } from "frontend_wasm";
import { WikipediaLink } from "../links/WikipediaLink";
import { WikimediaAudio } from "../components/WikimediaAudio";

// Pronunciation prescript codes and their outputs
const PRESCRIPTS: Record<string, ReactNode> = {
  lang: "English:",
  local: "locally",
  ipa: (
    <>
      <WikipediaLink pageTitle="International Phonetic Alphabet">
        IPA
      </WikipediaLink>
      :
    </>
  ),
  also: "also",
  uk: (
    <>
      <WikipediaLink pageTitle="British English">UK</WikipediaLink>:
    </>
  ),
  us: (
    <>
      <WikipediaLink pageTitle="American English">US</WikipediaLink>:
    </>
  ),
  uklang: (
    <>
      <WikipediaLink pageTitle="British English">British English</WikipediaLink>
      :
    </>
  ),
  uslang: (
    <>
      <WikipediaLink pageTitle="American English">
        American English
      </WikipediaLink>
      :
    </>
  ),
  ukalso: (
    <>
      <WikipediaLink pageTitle="British English">UK</WikipediaLink> also
    </>
  ),
  usalso: (
    <>
      <WikipediaLink pageTitle="American English">US</WikipediaLink> also
    </>
  ),
  alsouk: (
    <>
      also <WikipediaLink pageTitle="British English">UK</WikipediaLink>:
    </>
  ),
  alsous: (
    <>
      also <WikipediaLink pageTitle="American English">US</WikipediaLink>:
    </>
  ),
};

// Mapping for diaphonemes and their tooltip descriptions
// This is simplified - a complete implementation would include all diaphonemes from Help:IPA/English
const DIAPHONEMES: Record<string, { symbol: string; tooltip: string }> = {
  // Vowels
  æ: { symbol: "æ", tooltip: "'a' in 'trap'" },
  ɑː: { symbol: "ɑː", tooltip: "'a' in 'father'" },
  ə: { symbol: "ə", tooltip: "'a' in 'about'" },
  ʌ: { symbol: "ʌ", tooltip: "'u' in 'strut'" },
  ɛ: { symbol: "ɛ", tooltip: "'e' in 'dress'" },
  eɪ: { symbol: "eɪ", tooltip: "'ay' in 'face'" },
  ɪ: { symbol: "ɪ", tooltip: "'i' in 'kit'" },
  iː: { symbol: "iː", tooltip: "'ee' in 'fleece'" },
  ɒ: { symbol: "ɒ", tooltip: "'o' in 'lot'" },
  oʊ: { symbol: "oʊ", tooltip: "'o' in 'goat'" },
  ʊ: { symbol: "ʊ", tooltip: "'oo' in 'foot'" },
  uː: { symbol: "uː", tooltip: "'oo' in 'goose'" },
  aɪ: { symbol: "aɪ", tooltip: "'i' in 'price'" },
  aʊ: { symbol: "aʊ", tooltip: "'ow' in 'mouth'" },
  ɔɪ: { symbol: "ɔɪ", tooltip: "'oy' in 'choice'" },

  // Consonants
  b: { symbol: "b", tooltip: "'b' in 'bad'" },
  d: { symbol: "d", tooltip: "'d' in 'did'" },
  ð: { symbol: "ð", tooltip: "'th' in 'then'" },
  dʒ: { symbol: "dʒ", tooltip: "'j' in 'jam'" },
  f: { symbol: "f", tooltip: "'f' in 'fat'" },
  ɡ: { symbol: "ɡ", tooltip: "'g' in 'get'" },
  h: { symbol: "h", tooltip: "'h' in 'hat'" },
  j: { symbol: "j", tooltip: "'y' in 'yes'" },
  k: { symbol: "k", tooltip: "'k' in 'kit'" },
  l: { symbol: "l", tooltip: "'l' in 'let'" },
  m: { symbol: "m", tooltip: "'m' in 'mat'" },
  n: { symbol: "n", tooltip: "'n' in 'not'" },
  ŋ: { symbol: "ŋ", tooltip: "'ng' in 'sing'" },
  p: { symbol: "p", tooltip: "'p' in 'pat'" },
  r: { symbol: "r", tooltip: "'r' in 'red'" },
  s: { symbol: "s", tooltip: "'s' in 'sit'" },
  ʃ: { symbol: "ʃ", tooltip: "'sh' in 'she'" },
  t: { symbol: "t", tooltip: "'t' in 'tip'" },
  θ: { symbol: "θ", tooltip: "'th' in 'thin'" },
  v: { symbol: "v", tooltip: "'v' in 'vat'" },
  w: { symbol: "w", tooltip: "'w' in 'wet'" },
  z: { symbol: "z", tooltip: "'z' in 'zip'" },
  ʒ: { symbol: "ʒ", tooltip: "'s' in 'measure'" },

  // Stress marks
  ˈ: { symbol: "ˈ", tooltip: "primary stress" },
  ˌ: { symbol: "ˌ", tooltip: "secondary stress" },

  // Common X-SAMPA conversions (simplified)
  "'": { symbol: "ˈ", tooltip: "primary stress" },
  ",": { symbol: "ˌ", tooltip: "secondary stress" },
  "{": { symbol: "æ", tooltip: "'a' in 'trap'" },
  "@": { symbol: "ə", tooltip: "'a' in 'about'" },
};

// Handle special separators
const isSeparator = (token: string): boolean => {
  return token === "_" || token === "-" || token === ",_";
};

/**
 * Renders the `IPAc-en` template, which displays English IPA pronunciation with tooltips.
 */
export function IPAcEn({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  // Get all the parameters from the node
  const params = node.children;

  // Check if there's an audio file
  const audioParam = params.find((param) => param.name === "audio");
  const audioFile = audioParam?.value;

  // Filter out named parameters (like "audio")
  const positionalParams = params.filter(
    (param) => !param.name || !isNaN(parseInt(param.name))
  );

  // Process the parameters to identify prescripts and diaphonemes
  let currentIndex = 0;
  let prescript = null;

  // Check if the first parameter is a prescript
  if (
    positionalParams.length > 0 &&
    PRESCRIPTS[positionalParams[0].value.toLowerCase()]
  ) {
    prescript = PRESCRIPTS[positionalParams[0].value.toLowerCase()];
    currentIndex = 1;
  }

  // Process the remaining parameters as diaphonemes or separators
  const phonemeElements: JSX.Element[] = [];

  for (let i = currentIndex; i < positionalParams.length; i++) {
    const value = positionalParams[i].value;

    if (isSeparator(value)) {
      // Handle separators
      if (value === "_") {
        phonemeElements.push(<span key={`sep-${i}`}> </span>);
      } else if (value === ",_") {
        phonemeElements.push(<span key={`sep-${i}`}>, </span>);
      } else if (value === "-") {
        phonemeElements.push(<span key={`sep-${i}`}>-</span>);
      }
    } else {
      // Handle diaphonemes
      const diaphoneme = DIAPHONEMES[value];

      if (diaphoneme) {
        phonemeElements.push(
          <span
            key={`phoneme-${i}`}
            className="underline cursor-help"
            title={diaphoneme.tooltip}
          >
            {diaphoneme.symbol}
          </span>
        );
      } else {
        // For unrecognized inputs
        phonemeElements.push(<span key={`unknown-${i}`}>{value}</span>);
      }
    }
  }

  return (
    <span className="ipa-pronunciation">
      {prescript && <span>{prescript} </span>}
      <span className="ipa-notation">/{phonemeElements}/</span>
      {audioFile && (
        <span className="ipa-audio">
          {" "}
          <WikimediaAudio audioFile={audioFile} />
        </span>
      )}
    </span>
  );
}
