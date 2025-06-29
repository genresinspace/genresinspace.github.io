/**
 * Romanizes a Hangul (Korean) string using either Revised Romanization (default) or McCune–Reischauer.
 *
 * - If the input string starts with the '^' character, the first letter of the result will be capitalized.
 * - The '%' and '^' control symbols are removed before romanization.
 * - Only a basic set of Hangul syllables are mapped; unmapped characters are returned as-is.
 *
 * @param {string} hangul - The Hangul string to romanize. May include control symbols ('^' for capitalization, '%' for other control).
 * @param {boolean} [isRevisedRomanization=true] - If true, use Revised Romanization; if false, use McCune–Reischauer.
 * @returns {string} The romanized string, with optional capitalization if '^' is present.
 */
// Basic Hangul romanization - simplified implementation
export function romanizeHangul(
  hangul: string,
  isRevisedRomanization: boolean = true
): string {
  // Check for capitalization symbol before removing it
  const shouldCapitalize = hangul.startsWith("^");

  // Remove control symbols
  const cleanHangul = hangul.replace(/[%^]/g, "");

  // This is a very basic romanization - in practice you'd want a full implementation
  // For now, we'll do a simple character-by-character mapping for common characters
  const rrMap: Record<string, string> = {
    가: "ga",
    나: "na",
    다: "da",
    라: "ra",
    마: "ma",
    바: "ba",
    사: "sa",
    아: "a",
    자: "ja",
    차: "cha",
    카: "ka",
    타: "ta",
    파: "pa",
    하: "ha",
    게: "ge",
    네: "ne",
    데: "de",
    레: "re",
    메: "me",
    베: "be",
    세: "se",
    에: "e",
    제: "je",
    체: "che",
    케: "ke",
    테: "te",
    페: "pe",
    헤: "he",
    기: "gi",
    니: "ni",
    디: "di",
    리: "ri",
    미: "mi",
    비: "bi",
    시: "si",
    이: "i",
    지: "ji",
    치: "chi",
    키: "ki",
    티: "ti",
    피: "pi",
    히: "hi",
    고: "go",
    노: "no",
    도: "do",
    로: "ro",
    모: "mo",
    보: "bo",
    소: "so",
    오: "o",
    조: "jo",
    초: "cho",
    코: "ko",
    토: "to",
    포: "po",
    호: "ho",
    구: "gu",
    누: "nu",
    두: "du",
    루: "ru",
    무: "mu",
    부: "bu",
    수: "su",
    우: "u",
    주: "ju",
    추: "chu",
    쿠: "ku",
    투: "tu",
    푸: "pu",
    후: "hu",
    방: "bang",
    강: "gang",
    동: "dong",
    성: "seong",
    한: "han",
    국: "guk",
    서: "seo",
    울: "ul",
    김: "kim",
    박: "bak",
    최: "choi",
    팝: "pap", // For K-pop (케이팝)
  };

  const mrMap: Record<string, string> = {
    가: "ka",
    나: "na",
    다: "ta",
    라: "ra",
    마: "ma",
    바: "pa",
    사: "sa",
    아: "a",
    자: "cha",
    차: "ch'a",
    카: "k'a",
    타: "t'a",
    파: "p'a",
    하: "ha",
    게: "ke",
    네: "ne",
    데: "te",
    레: "re",
    메: "me",
    베: "pe",
    세: "se",
    에: "e",
    제: "che",
    체: "ch'e",
    케: "k'e",
    테: "t'e",
    페: "p'e",
    헤: "he",
    기: "ki",
    니: "ni",
    디: "ti",
    리: "ri",
    미: "mi",
    비: "pi",
    시: "si",
    이: "i",
    지: "chi",
    치: "ch'i",
    키: "k'i",
    티: "t'i",
    피: "p'i",
    히: "hi",
    고: "ko",
    노: "no",
    도: "to",
    로: "ro",
    모: "mo",
    보: "po",
    소: "so",
    오: "o",
    조: "cho",
    초: "ch'o",
    코: "k'o",
    토: "t'o",
    포: "p'o",
    호: "ho",
    구: "ku",
    누: "nu",
    두: "tu",
    루: "ru",
    무: "mu",
    부: "pu",
    수: "su",
    우: "u",
    주: "chu",
    추: "ch'u",
    쿠: "k'u",
    투: "t'u",
    푸: "p'u",
    후: "hu",
    방: "pang",
    강: "kang",
    동: "tong",
    성: "sŏng",
    한: "han",
    국: "kuk",
    서: "sŏ",
    울: "ul",
    김: "kim",
    박: "pak",
    최: "ch'oe",
    팝: "pap", // For K-pop (케이팝)
  };

  const map = isRevisedRomanization ? rrMap : mrMap;

  let result = "";
  for (const char of cleanHangul) {
    if (map[char]) {
      result += map[char];
    } else {
      // If no mapping found, keep the original character
      result += char;
    }
  }

  // Apply capitalization if needed
  if (shouldCapitalize && result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}
