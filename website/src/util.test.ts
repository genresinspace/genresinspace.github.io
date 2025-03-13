import { stripGenreNamePrefixFromDescription } from "./util";

describe("stripGenreNamePrefixFromDescription", () => {
  test('removes "Hip house" prefix from description', () => {
    const testCase = {
      label: "Hip house",
      description:
        "'''Hip house''', also known as '''rap house''' or '''house rap''', is a musical genre that mixes elements of [[house music]] and [[hip hop music]], that originated in both London and [[Chicago]] in the mid-to-late 1980s.\n\nA British collaboration between the electronic group [[Beatmasters]] and the rap duo [[Cookie Crew]] created \"[[Rok da House]]\"; possibly the first hip house single.",
      description_output:
        "also known as '''rap house''' or '''house rap''', is a musical genre that mixes elements of [[house music]] and [[hip hop music]], that originated in both London and [[Chicago]] in the mid-to-late 1980s.\n\nA British collaboration between the electronic group [[Beatmasters]] and the rap duo [[Cookie Crew]] created \"[[Rok da House]]\"; possibly the first hip house single.",
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });

  test('removes "Stadium house" prefix from description', () => {
    const testCase = {
      label: "Stadium house",
      description:
        "'''Stadium house''' is a genre of dance music which was most successful in the early 1990s. Acts such as [[the KLF]] and [[Utah Saints]] combined house music with other elements more typical in [[rock music]], such as bombastic live shows and even guitarists, to add additional impact to their music and appearance, in order to fill large venues and drive audience participation, or convey a live atmosphere in their recordings. Artists in this genre typically made heavy use of samples, and frequently sampled crowd noise for use in their music.\n\nThe term was made popular by the KLF, who released a video collection called ''The Stadium House Trilogy'' covering three of their videos. KLF member [[Bill Drummond]] himself referred to [[Utah Saints]] as \"the first true stadium house band\".\n\nArtists frequently classified in this genre include:\n\n* [[The KLF]]<ref>{{Cite web|url=https://www.youtube.com/watch?v=RN7o7lmbp8Y|title=Rapido TV - The KLF|website=[[YouTube]] }}</ref><ref>{{Cite web|url=https://www.youtube.com/watch?v=izm8vJbuwGM|title=The KLF return after 23 year absence – Channel 4 News 23/08/2017|website=[[YouTube]] }}</ref>\n* [[Utah Saints]]\n* [[Faithless]]<ref>{{Cite web|url=https://www.musicomh.com/reviews/albums/faithless-no-roots|title=Faithless - No Roots|date=6 June 2004 }}</ref>\n* [[The Prodigy]]\n* [[Basement Jaxx]]<ref>{{Cite web|url=https://musicismthought.wordpress.com/2016/07/07/the-secret-history-of-basement-jaxx/|title=The secret history of Basement Jaxx|date=7 July 2016 }}</ref>\n* [[Underworld (band)|Underworld]]<ref>{{Cite web|url=http://www.supajam.com/blog/article/Bands-changing-direction|title=Bands changing direction}}</ref>\n* [[The Chemical Brothers]]\n* [[Orbital (band)|Orbital]]\n* [[2 Unlimited]]",
      description_output:
        "is a genre of dance music which was most successful in the early 1990s. Acts such as [[the KLF]] and [[Utah Saints]] combined house music with other elements more typical in [[rock music]], such as bombastic live shows and even guitarists, to add additional impact to their music and appearance, in order to fill large venues and drive audience participation, or convey a live atmosphere in their recordings. Artists in this genre typically made heavy use of samples, and frequently sampled crowd noise for use in their music.\n\nThe term was made popular by the KLF, who released a video collection called ''The Stadium House Trilogy'' covering three of their videos. KLF member [[Bill Drummond]] himself referred to [[Utah Saints]] as \"the first true stadium house band\".\n\nArtists frequently classified in this genre include:\n\n* [[The KLF]]<ref>{{Cite web|url=https://www.youtube.com/watch?v=RN7o7lmbp8Y|title=Rapido TV - The KLF|website=[[YouTube]] }}</ref><ref>{{Cite web|url=https://www.youtube.com/watch?v=izm8vJbuwGM|title=The KLF return after 23 year absence – Channel 4 News 23/08/2017|website=[[YouTube]] }}</ref>\n* [[Utah Saints]]\n* [[Faithless]]<ref>{{Cite web|url=https://www.musicomh.com/reviews/albums/faithless-no-roots|title=Faithless - No Roots|date=6 June 2004 }}</ref>\n* [[The Prodigy]]\n* [[Basement Jaxx]]<ref>{{Cite web|url=https://musicismthought.wordpress.com/2016/07/07/the-secret-history-of-basement-jaxx/|title=The secret history of Basement Jaxx|date=7 July 2016 }}</ref>\n* [[Underworld (band)|Underworld]]<ref>{{Cite web|url=http://www.supajam.com/blog/article/Bands-changing-direction|title=Bands changing direction}}</ref>\n* [[The Chemical Brothers]]\n* [[Orbital (band)|Orbital]]\n* [[2 Unlimited]]",
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });

  test('removes "House-pop" prefix from description', () => {
    const testCase = {
      label: "House-pop",
      description:
        'House-pop (sometimes also called "pop-house") is a crossover of [[house music|house]] and [[dance-pop]] music that emerged in early \'90s. The genre was created to make house music more radio friendly. The characteristic of house-pop is similar to [[diva house]] music, like over-the-top vocal acrobatics, bubbly synth riffs, and four-on-the-floor rhythm. House-pop also has hip-hop influence.',
      description_output:
        '(sometimes also called "pop-house") is a crossover of [[house music|house]] and [[dance-pop]] music that emerged in early \'90s. The genre was created to make house music more radio friendly. The characteristic of house-pop is similar to [[diva house]] music, like over-the-top vocal acrobatics, bubbly synth riffs, and four-on-the-floor rhythm. House-pop also has hip-hop influence.',
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });

  test("does not modify description that does not start with genre name", () => {
    const testCase = {
      label: "Scouse house",
      description:
        "'''Donk''', also known as Bounce or Hard Bounce, is a style of UK Hard House \"featuring an upbeat, energetic sound and a heavy focus on the 'pipe' sample as an offbeat bassline\". There is debate about Donk's origin, but the sounds are thought to have come from the [[Netherlands]] in the 1990s. The name itself is a neologism, derived from the scene in the UK. In the UK, the style originated in [[North West England]], around towns and cities such as [[Wigan]], [[Liverpool]], [[Bolton]], [[Blackburn]], and [[Burnley]], and was first known as Scouse House or Bounce - as it spread out of the area and became more mainstream, it became known as Donk. \"Donk\" was the name given to the \"particularly rubbery, rebounding thwack\" sound that predominated Donk tracks and became \"the umbrella term for the genres that feature it\". In other parts of Europe, the versions of Donk are known as [[#Pumping house|bumping]] and poky (Spain); in Russia, as [[#Hardbass|Hardbass]]. Critic [[Simon Reynolds]] drew comparisons with American regional hip hop styles, such as [[bounce music|bounce]], [[crunk]], [[hyphy]], [[snap music|snap]] and [[juke music]]",
      description_output:
        "'''Donk''', also known as Bounce or Hard Bounce, is a style of UK Hard House \"featuring an upbeat, energetic sound and a heavy focus on the 'pipe' sample as an offbeat bassline\". There is debate about Donk's origin, but the sounds are thought to have come from the [[Netherlands]] in the 1990s. The name itself is a neologism, derived from the scene in the UK. In the UK, the style originated in [[North West England]], around towns and cities such as [[Wigan]], [[Liverpool]], [[Bolton]], [[Blackburn]], and [[Burnley]], and was first known as Scouse House or Bounce - as it spread out of the area and became more mainstream, it became known as Donk. \"Donk\" was the name given to the \"particularly rubbery, rebounding thwack\" sound that predominated Donk tracks and became \"the umbrella term for the genres that feature it\". In other parts of Europe, the versions of Donk are known as [[#Pumping house|bumping]] and poky (Spain); in Russia, as [[#Hardbass|Hardbass]]. Critic [[Simon Reynolds]] drew comparisons with American regional hip hop styles, such as [[bounce music|bounce]], [[crunk]], [[hyphy]], [[snap music|snap]] and [[juke music]]",
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });

  test("ignores case when stripping genre name", () => {
    const testCase = {
      label: "Christian Hip Hop",
      description:
        "'''Christian hip hop''' (originally '''gospel rap''', also known as '''Christian rap''', '''gospel hip hop''' or '''holy hip hop''') is a cross-genre of [[contemporary Christian music]] and [[hip-hop]].",
      description_output:
        "(originally '''gospel rap''', also known as '''Christian rap''', '''gospel hip hop''' or '''holy hip hop''') is a cross-genre of [[contemporary Christian music]] and [[hip-hop]].",
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });

  test("ignores 'the' when stripping bolded genre name", () => {
    const testCase = {
      label: "Bakersfield sound",
      description:
        "The '''Bakersfield sound''' is a sub-[[musical genre|genre]] of [[country music]] developed in the mid-to-late 1950s in and around [[Bakersfield, California]].",
      description_output:
        "is a sub-[[musical genre|genre]] of [[country music]] developed in the mid-to-late 1950s in and around [[Bakersfield, California]].",
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });

  test("ignores 'the' when stripping genre name", () => {
    const testCase = {
      label: "Bakersfield sound",
      description:
        "The Bakersfield sound is a sub-[[musical genre|genre]] of [[country music]] developed in the mid-to-late 1950s in and around [[Bakersfield, California]].",
      description_output:
        "is a sub-[[musical genre|genre]] of [[country music]] developed in the mid-to-late 1950s in and around [[Bakersfield, California]].",
    };

    expect(
      stripGenreNamePrefixFromDescription(testCase.label, testCase.description)
    ).toBe(testCase.description_output);
  });
});
