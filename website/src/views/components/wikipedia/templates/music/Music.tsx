import { TimeSignature } from "./TimeSignature";

/**
 * Renders the `music` template for music notation symbols using Unicode where available
 */
export function Music({
  symbol,
  param2,
  param3,
}: {
  symbol: string;
  param2?: string;
  param3?: string;
}) {
  // Convert symbol to lowercase for case-insensitive matching
  const lowerSymbol = symbol.toLowerCase();

  // Handle chord notation with superscript/subscript
  const renderChordNotation = (notation: string) => {
    if (notation === "6") return <sup>6</sup>;
    if (notation === "7 chord") return <sup>7</sup>;
    if (notation === "2" || notation === "2 chord") return <sup>2</sup>;

    // Handle complex notations with both superscript and subscript
    if (notation === "64" || notation === "64 chord")
      return (
        <span>
          <sup>6</sup>
          <sub>4</sub>
        </span>
      );
    if (notation === "63" || notation === "63 chord")
      return (
        <span>
          <sup>6</sup>
          <sub>3</sub>
        </span>
      );
    if (notation === "53" || notation === "53 chord")
      return (
        <span>
          <sup>5</sup>
          <sub>3</sub>
        </span>
      );
    if (notation === "65" || notation === "65 chord")
      return (
        <span>
          <sup>6</sup>
          <sub>5</sub>
        </span>
      );
    if (notation === "43 chord")
      return (
        <span>
          <sup>4</sup>
          <sub>3</sub>
        </span>
      );
    if (notation === "42" || notation === "42 chord")
      return (
        <span>
          <sup>4</sup>
          <sub>2</sub>
        </span>
      );
    if (notation === "07 chord")
      return (
        <span>
          <sup>0</sup>
          <sub>7</sub>
        </span>
      );
    if (notation === "75" || notation === "75 chord")
      return (
        <span>
          <sup>7</sup>
          <sub>5</sub>
        </span>
      );

    // More complex notations could be handled here
    return <span>{notation}</span>;
  };

  switch (lowerSymbol) {
    // Accidentals
    case "♭":
    case "b":
    case "flat":
      return <span className="music-flat">♭</span>;
    case "𝄫":
    case "bb":
    case "double flat":
    case "doubleflat":
      return <span>𝄫</span>;
    case "bbb":
    case "triple flat":
    case "tripleflat":
      return <span>♭♭♭</span>; // Fallback for triple flat
    case "d":
    case "half flat":
    case "halfflat":
      return <span>𝄳</span>; // Using closest Unicode symbol
    case "♮":
    case "n":
    case "natural":
      return <span className="music-natural">♮</span>;
    case "♯":
    case "#":
    case "sharp":
      return <span className="music-sharp">♯</span>;
    case "𝄪":
    case "x":
    case "##":
    case "double sharp":
    case "doublesharp":
      return <span>𝄪</span>;
    case "###":
    case "#x":
    case "x#":
    case "triple sharp":
    case "triplesharp":
      return <span>♯♯♯</span>; // Fallback for triple sharp
    case "t":
    case "half sharp":
    case "halfsharp":
      return <span>𝄲</span>; // Using closest Unicode symbol

    // Note values
    case "doublewholenote":
    case "double whole note":
    case "doublenote":
    case "double note":
    case "breve":
      return <span>𝅜</span>;
    case "wholenote":
    case "whole note":
    case "whole":
    case "semibreve":
      return <span>𝅝</span>;
    case "halfnote":
    case "half note":
    case "half":
    case "minim":
      return <span>𝅗𝅥</span>;
    case "quarternote":
    case "quarter note":
    case "quarter":
    case "crotchet":
      return <span>𝅘𝅥</span>;
    case "eighthnote":
    case "eighth note":
    case "eighth":
    case "quaver":
      return <span>𝅘𝅥𝅮</span>;
    case "eighthnotebeam":
    case "eighth note beam":
    case "eighthbeam":
    case "eighth beam":
    case "quaverbeam":
    case "quaver beam":
      return <span>𝅘𝅥𝅮𝅘𝅥𝅮</span>;
    case "sixteenthnote":
    case "sixteenth note":
    case "sixteenth":
    case "semiquaver":
      return <span>𝅘𝅥𝅯</span>;
    case "thirtysecondnote":
    case "thirtysecond note":
    case "thirty-secondnote":
    case "thirty-second note":
    case "thirtysecond":
    case "thirty-second":
    case "32nd":
    case "32nd note":
    case "demisemiquaver":
      return <span>𝅘𝅥𝅰</span>;
    case "sixtyfourthnote":
    case "sixtyfourth note":
    case "sixty-fourthnote":
    case "sixty-fourth note":
    case "sixtyfourth":
    case "sixty-fourth":
    case "64th":
    case "64th note":
    case "hemidemisemiquaver":
      return <span>𝅘𝅥𝅱</span>;

    // Dotted notes
    case "dottedquarter":
    case "dotted quarter":
    case "dottedcrotchet":
    case "dotted crotchet":
      return <span>𝅘𝅥.</span>;
    case "dottedhalf":
    case "dotted half":
    case "dottedminim":
    case "dotted minim":
      return <span>𝅗𝅥.</span>;

    // Rests
    case "wholerest":
    case "whole rest":
    case "semibreverest":
    case "semibreve rest":
      return <span>𝄻</span>;
    case "halfrest":
    case "half rest":
    case "minimrest":
    case "minim rest":
      return <span>𝄼</span>;
    case "quarterrest":
    case "quarter rest":
    case "crotchet rest":
    case "crotchetrest":
      return <span>𝄽</span>;
    case "eighthrest":
    case "eighth rest":
    case "quaver rest":
    case "quaverrest":
      return <span>𝄾</span>;
    case "sixteenthrest":
    case "sixteenth rest":
    case "semiquaver rest":
    case "semiquaverrest":
      return <span>𝄿</span>;
    case "thirtysecondrest":
    case "thirtysecond rest":
    case "thirty-secondrest":
    case "thirty-second rest":
    case "32nd rest":
    case "demisemiquaver rest":
    case "demisemiquaverrest":
      return <span>𝅀</span>;
    case "sixtyfourthrest":
    case "sixtyfourth rest":
    case "sixty-fourthrest":
    case "sixty-fourth rest":
    case "64th rest":
    case "hemidemisemiquaver rest":
    case "hemidemisemiquaverrest":
      return <span>𝅁</span>;

    // Clefs
    case "treble":
    case "treble clef":
    case "trebleclef":
    case "g clef":
    case "gclef":
      return <span>𝄞</span>;
    case "bass":
    case "bass clef":
    case "bassclef":
    case "f clef":
    case "fclef":
      return <span>𝄢</span>;
    case "alto":
    case "alto clef":
    case "altoclef":
    case "tenor":
    case "tenor clef":
    case "tenorclef":
    case "c clef":
    case "cclef":
      return <span>𝄡</span>;
    case "neutral":
    case "neutralclef":
    case "neutral clef":
      return <span>||</span>;

    // Time signatures
    case "common":
    case "commontime":
    case "common-time":
      return <span>𝄴</span>;
    case "alla-breve":
    case "allabreve":
    case "cut":
    case "cuttime":
    case "cut-time":
      return <span>𝄵</span>;
    case "time":
    case "timesig":
    case "time sig":
    case "timesignature":
    case "time signature":
      return (
        <TimeSignature numerator={param2 || "4"} denominator={param3 || "4"} />
      );

    // Chord symbols
    case "°":
    case "diminished":
    case "dim":
      return <sup>o</sup>;
    case "dimdeg":
      return <>°</>;
    case "ø":
    case "halfdim":
    case "half dim":
    case "halfdiminished":
    case "half diminished":
    case "dimslash":
      return <sup>ø</sup>;
    case "aug":
    case "augmented":
      return <sup>+</sup>;
    case "maj":
    case "major":
    case "delta":
    case "δ":
      return <span>Δ</span>;

    // Numeric chord symbols
    case "6":
    case "64":
    case "63":
    case "6 chord":
    case "53":
    case "53 chord":
    case "7 chord":
    case "65":
    case "65 chord":
    case "43 chord":
    case "2":
    case "2 chord":
    case "42":
    case "42 chord":
    case "07 chord":
    case "75":
    case "75 chord":
    case "643":
    case "643 chord":
    case "642":
    case "642 chord":
      return renderChordNotation(lowerSymbol);

    // Special characters
    case "em_dash":
    case "emdash":
      return <>—</>;
    case "en_dash":
    case "endash":
    case "ndash":
      return <>–</>;
    case "snd":
      return <> – </>;
    case "dot":
      return <>.</>;
    case "nbsp":
      return <>&nbsp;</>;

    // Plus/minus
    case "+":
    case "plus":
      return <>+</>;
    case "-":
    case "minus":
      return <>-</>;

    // Repeat signs
    case "left repeat":
    case "leftrepeat":
      return <span>𝄆</span>;
    case "repeat":
    case "right repeat":
    case "rightrepeat":
      return <span>𝄇</span>;

    // Key signatures - simplified representation
    case "c major":
    case "a minor":
      return <span title="C major / A minor">♮</span>;
    case "g major":
    case "e minor":
      return <span title="G major / E minor">♯</span>;
    case "f major":
    case "d minor":
      return <span title="F major / D minor">♭</span>;

    // Editorial markings
    case "sic":
      return <>[sic]</>;

    // Septimal notation and microtonal symbols
    case "septimal minus":
    case "7":
      return <span>7↓</span>;
    case "l":
    case "ㄥ":
    case "7u":
    case "u7":
    case "septimal plus":
      return <span>7↑</span>;
    case "11":
    case "11 up":
    case "11 plus":
      return <span>11↑</span>;
    case "11 minus":
    case "11 down":
    case "11u":
    case "u11":
      return <span>11↓</span>;
    case "up":
      return <>↑</>;
    case "down":
      return <>↓</>;

    // Default case for unrecognized symbols
    default:
      // If this appears to be a key signature format but not handled above
      if (lowerSymbol.includes("major") || lowerSymbol.includes("minor")) {
        return <span>{symbol.replace(/-/g, " ")}</span>;
      }

      return <span title={`Music symbol: ${symbol}`}>♪</span>; // Musical note symbol as fallback
  }
}
