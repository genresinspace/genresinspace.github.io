import { REPO_LINK } from "../../data";

import { ExternalLink } from "../components/links/ExternalLink";

/** The FAQ for the project. */
export function FAQ({ dumpDate }: { dumpDate: string }) {
  const faqs = [
    {
      question: "Why build this?",
      answer: (
        <>
          <p>
            When I'm working on things, I often listen to genre mixes on
            YouTube; the curation by connoisseurs, especially well-mixed, is
            sublime. However, I wanted to branch out and listen to genres that I
            was unfamiliar with, but with the condition that I wanted to explore
            outwards from what I already knew.
          </p>
          <p>
            However, I have a tendency to start projects with too large a scope,
            which inevitably leads to them never being finished. I didn't want
            to work my way through a checklist and burn out on music-listening
            homework.
          </p>
          <p>
            While working on{" "}
            <ExternalLink href="https://philpax.me">my website</ExternalLink>, I
            became reacquainted with{" "}
            <ExternalLink href="https://eightyeightthirty.one">
              8831
            </ExternalLink>
            , a project by my friend,{" "}
            <ExternalLink href="https://notnite.me">NotNite</ExternalLink>.
            Looking at it, I realised I could create a project that I could
            actually finish that would actually solve a problem I actually have:
            I could visualise the graph of genres - or at least the ones English
            Wikipedia knows about - and attach mixes to each genre, so that I
            could share a little taste of everything with the world (including
            myself!)
          </p>
          <p>
            In addition to that, Wikipedia is one of the greatest resources of
            our time, and I wanted to do two things: encourage people to improve
            this little slice of it (I've certainly made a few edits while
            working on this!) and to draw attention to{" "}
            <ExternalLink href="https://www.theatlantic.com/technology/archive/2025/02/elon-musk-wikipedia/681577/">
              the vicious attacks by people who would rather you didn't know any
              better
            </ExternalLink>
            . Don't let them take it from you.
          </p>
        </>
      ),
    },
    {
      question: `Why is the data ${Math.ceil(
        (Date.now() - new Date(dumpDate).getTime()) / (1000 * 60 * 60 * 24)
      )} days old?`,
      answer: (
        <>
          <p>
            This website does not use live data from Wikipedia, because finding
            all of the genres and the links between them would be unkind to
            Wikipedia's API.
          </p>
          <p>
            Instead, I used one of Wikipedia's regularly-scheduled database
            downloads ("dumps"), which allowed me to process every article and
            link to my heart's content without worrying about being a bad
            internet citizen.
          </p>
          <p>
            Every once in a while, I will manually update the dump used to the
            latest version available. I wouldn't mind automating this, but as
            you might imagine, processing all of Wikipedia requires
            computational resources that I have access to locally, but that I'd
            have to pay for if I ran it remotely. Some day, maybe.
          </p>
        </>
      ),
    },
    {
      question: "Why is the graph missing genres?",
      answer: (
        <>
          <p>
            The English Wikipedia doesn't capture the full breadth of the world
            of music for a variety of reasons:
          </p>
          <ul className="list-disc pl-5">
            <li>the genre is poorly known in the English-speaking world</li>
            <li>nobody has made the time to write an article about it</li>
            <li>
              it's just not notable enough to merit an entire article, or a
              section of an article
            </li>
            <li>
              it's not treated as a genre unto itself by Wikipedia: for example,
              "classical music" is too broad to be considered just one genre, so
              it's not represented here outside of downstream genres
            </li>
          </ul>
          <p>
            This sucks, but it means that every genre covered here has{" "}
            <em>some</em> information attached to it to help you contextualise
            it. In future, I may consider using genres from MusicBrainz and/or
            other-language Wikis.
          </p>
          <p>
            To see what's <em>really</em> out there, check out{" "}
            <ExternalLink href="https://musicbrainz.org/genres">
              MusicBrainz' genres
            </ExternalLink>
            , or poke around{" "}
            <ExternalLink href="https://everynoise.com/">
              Every Noise At Once
            </ExternalLink>
            .
          </p>
          <p>
            Of course, I encourage you to take matters into your own hands: if
            there's a genre that you think should be here, you can update
            Wikipedia and make that a reality! Spread knowledge of <em>your</em>{" "}
            favourite genre to everyone!
          </p>
        </>
      ),
    },
    {
      question: "Who selected the mixes, and under what criteria?",
      answer: (
        <>
          <p>
            I did, under vibes-based criteria: I looked at the most
            relevant/most viewed mixes for a given genre, and then picked the
            mixes that looked like they had the most effort/love/curation. With
            that being said, however, I also consulted both my own experience
            and that of friends' to help in selecting representative mixes.
          </p>
          <p>
            My selection is not perfect; I had to make judgement calls and to
            apply my own curatorial taste, which can be difficult when I'm not
            acquainted with the genre. For genres that span multiple decades,
            I've tried to pick mixes that cover the most iconic decade, which
            means there's a bias towards more historical tracks. Sorry!
          </p>
          <p>
            I'm <em>very</em> open to suggestions for new mixes or replacements
            - see the FAQ entry below on how to contact me!
          </p>
        </>
      ),
    },
    {
      question: "How does this compare to the other music mapping projects?",
      answer: (
        <>
          <p>
            I encourage you to check out other projects of a similar ilk! This
            project is designed to show you how the genres are connected, and to
            give you a representative mix for each; but you may find other maps
            more germane to your interests.
          </p>
          <p>Here's the ones I'm aware of:</p>
          <ul className="list-disc pl-5">
            <li>
              <ExternalLink href="https://everynoise.com/">
                Every Noise At Once
              </ExternalLink>
              : a word cloud of genres, arranged across axes, and with
              perspective-altering filters to further contextualise the
              development and influence of each genre
            </li>
            <li>
              <ExternalLink href="https://musicmap.info/">
                Musicmap
              </ExternalLink>
              : an extremely-well-researched, high-quality map of the world of
              music, with genealogy, purpose-written text, references, and more
            </li>
          </ul>
        </>
      ),
    },
    {
      question: "Why is it difficult to pan the graph at times?",
      answer: (
        <>
          <p>
            That's a technical limitation of the solution I'm using for the
            graph: the labels for each genre block the motion for panning, and
            there are a *lot* of labels. I'm still working on a way to address
            this.
          </p>
          <p>
            In the meantime, you may want to consider turning off labels in the
            settings.
          </p>
        </>
      ),
    },
    {
      question: "What's with the ring of genres around the graph?",
      answer: (
        <p>
          Those are genres that have very few, or zero, connections to the rest
          of the graph. This can happen because their connections are
          poorly-documented, they're unique and have few connections to other
          genres (most often the case with traditional cultural music), or
          they're too broad to be a distinct entity that other genres can
          connect to.
        </p>
      ),
    },
    {
      question:
        "Why are some genres' descriptions kind of broken, but look fine on Wikipedia?",
      answer: (
        <>
          <p>
            Wikipedia articles are written in "wikitext". I process the raw
            wikitext to extract information, and then use my own code to display
            that wikitext here by roughly replicating Wikipedia's display logic.
          </p>
          <p>
            Unfortunately, my code isn't perfect: it's basically a Minimum
            Viable Product, and has <em>many</em> rough edges. It especially
            breaks down around non-English languages (sorry!). Please write to
            me if you see something egregiously broken!
          </p>
        </>
      ),
    },
    {
      question:
        "I'd like to reach out to you about a bug/a feature/a music mix/something else. How can I do that?",
      answer: (
        <p>
          If you have a GitHub account, I'd appreciate you creating an issue in{" "}
          <ExternalLink href={REPO_LINK}>the repository</ExternalLink>.
          Otherwise, feel free to contact me through one of the means mentioned
          on <ExternalLink href="https://philpax.me">my website</ExternalLink>!
        </p>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 text-sm">
      {faqs.map((faq, index) => (
        <div key={index}>
          <p className="font-bold">{faq.question}</p>
          <div className="mt-1 flex flex-col gap-2">{faq.answer}</div>
        </div>
      ))}
    </div>
  );
}
