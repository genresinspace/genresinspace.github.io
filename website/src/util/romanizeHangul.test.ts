import { romanizeHangul } from "./romanizeHangul";

describe("romanizeHangul", () => {
  describe("basic romanization", () => {
    test("should romanize basic syllables with RR", () => {
      expect(romanizeHangul("가", true)).toBe("ga");
      expect(romanizeHangul("나", true)).toBe("na");
      expect(romanizeHangul("다", true)).toBe("da");
      expect(romanizeHangul("라", true)).toBe("ra");
      expect(romanizeHangul("마", true)).toBe("ma");
    });

    test("should romanize basic syllables with MR", () => {
      expect(romanizeHangul("가", false)).toBe("ka");
      expect(romanizeHangul("나", false)).toBe("na");
      expect(romanizeHangul("다", false)).toBe("ta");
      expect(romanizeHangul("라", false)).toBe("ra");
      expect(romanizeHangul("마", false)).toBe("ma");
    });

    test("should romanize different vowels", () => {
      expect(romanizeHangul("게", true)).toBe("ge");
      expect(romanizeHangul("기", true)).toBe("gi");
      expect(romanizeHangul("고", true)).toBe("go");
      expect(romanizeHangul("구", true)).toBe("gu");
    });
  });

  describe("케이팝 test case", () => {
    test("케이팝 should romanize to keipap without capitalization", () => {
      expect(romanizeHangul("케이팝", true)).toBe("keipap");
    });

    test("케이팝 should romanize to Keipap with capitalization", () => {
      expect(romanizeHangul("^케이팝", true)).toBe("Keipap");
    });
  });

  describe("RR vs MR differences", () => {
    test("should handle aspirated consonants differently", () => {
      // RR uses simple letters
      expect(romanizeHangul("차", true)).toBe("cha");
      expect(romanizeHangul("카", true)).toBe("ka");
      expect(romanizeHangul("타", true)).toBe("ta");
      expect(romanizeHangul("파", true)).toBe("pa");

      // MR uses apostrophes for aspirated consonants
      expect(romanizeHangul("차", false)).toBe("ch'a");
      expect(romanizeHangul("카", false)).toBe("k'a");
      expect(romanizeHangul("타", false)).toBe("t'a");
      expect(romanizeHangul("파", false)).toBe("p'a");
    });

    test("should handle voiced consonants differently", () => {
      // RR
      expect(romanizeHangul("자", true)).toBe("ja");
      expect(romanizeHangul("지", true)).toBe("ji");

      // MR
      expect(romanizeHangul("자", false)).toBe("cha");
      expect(romanizeHangul("지", false)).toBe("chi");
    });
  });

  describe("capitalization", () => {
    test("should capitalize when ^ symbol is present", () => {
      expect(romanizeHangul("^가", true)).toBe("Ga");
      expect(romanizeHangul("^한국", true)).toBe("Hanguk");
      expect(romanizeHangul("^서울", true)).toBe("Seoul");
    });

    test("should not capitalize without ^ symbol", () => {
      expect(romanizeHangul("가", true)).toBe("ga");
      expect(romanizeHangul("한국", true)).toBe("hanguk");
      expect(romanizeHangul("서울", true)).toBe("seoul");
    });

    test("should remove ^ symbol from output", () => {
      expect(romanizeHangul("^가", true)).not.toContain("^");
      expect(romanizeHangul("^한국", true)).not.toContain("^");
    });
  });

  describe("control symbols", () => {
    test("should remove % symbol (namemode)", () => {
      expect(romanizeHangul("%김", true)).toBe("kim");
      expect(romanizeHangul("%박", true)).toBe("bak");
      expect(romanizeHangul("%김", true)).not.toContain("%");
    });

    test("should remove ^ symbol (capitalize)", () => {
      expect(romanizeHangul("^김", true)).toBe("Kim");
      expect(romanizeHangul("^김", true)).not.toContain("^");
    });

    test("should handle both symbols together", () => {
      expect(romanizeHangul("%^김", true)).toBe("kim"); // % comes first, so no capitalization
      expect(romanizeHangul("^%김", true)).toBe("Kim"); // ^ comes first, so capitalization applies
    });
  });

  describe("complex words", () => {
    test("should romanize multi-syllable words", () => {
      expect(romanizeHangul("한국", true)).toBe("hanguk");
      expect(romanizeHangul("서울", true)).toBe("seoul");
      expect(romanizeHangul("방", true)).toBe("bang");
    });

    test("should handle MR for complex words", () => {
      expect(romanizeHangul("한국", false)).toBe("hankuk");
      expect(romanizeHangul("서울", false)).toBe("sŏul");
      expect(romanizeHangul("방", false)).toBe("pang");
    });
  });

  describe("unknown characters", () => {
    test("should preserve unknown characters", () => {
      expect(romanizeHangul("가x나", true)).toBe("gaxna"); // x stays as x, 나 becomes na
      expect(romanizeHangul("가1나", true)).toBe("ga1na");
      expect(romanizeHangul("가 나", true)).toBe("ga na");
    });
  });

  describe("edge cases", () => {
    test("should handle empty string", () => {
      expect(romanizeHangul("", true)).toBe("");
      expect(romanizeHangul("", false)).toBe("");
    });

    test("should handle only control symbols", () => {
      expect(romanizeHangul("^", true)).toBe("");
      expect(romanizeHangul("%", true)).toBe("");
      expect(romanizeHangul("%^", true)).toBe("");
    });

    test("should handle single characters", () => {
      expect(romanizeHangul("가", true)).toBe("ga");
      expect(romanizeHangul("^가", true)).toBe("Ga");
    });
  });
});
