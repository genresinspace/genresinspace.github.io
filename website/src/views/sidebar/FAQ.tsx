import { REPO_LINK } from "../../data";
import { Collapsible } from "../components/Collapsible";

import { ExternalLink } from "../components/links/ExternalLink";

/** The FAQ for the project. */
export function FAQ({ dumpDate }: { dumpDate: string }) {
  const faqs = [
    {
      question: "Why build this?",
      answer: (
        <>
          <p>
            When I'm working - on actual work, or on my own projects - I often
            listen to genre mixes on YouTube; the curation by connoisseurs,
            especially when well-mixed, is sublime. I can't just listen to the
            same genres, though: I wanted to branch out and listen to unfamiliar
            genres, starting from what I already know and working outward.
          </p>
          <p>
            When thinking about this predicament, I was reminded of{" "}
            <ExternalLink href="https://eightyeightthirty.one">
              8831
            </ExternalLink>
            , a project by my friend,{" "}
            <ExternalLink href="https://notnite.me">NotNite</ExternalLink>.
            Looking at it, I realised I could create a project that I could
            actually finish that would actually solve a problem I actually have:
            I could visualise the graph of genres - or at least the ones English
            Wikipedia knows about - and attach mixes to each genre, so that I
            could share a little taste of everything with the world.
          </p>
          <p>
            More importantly, I love Wikipedia. It's one of humanity's greatest
            achievements in the domain of knowledge, and I wanted to pay homage
            by presenting its information through a lens that encourages
            exploration of another kind.
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
            This website does not use live data from Wikipedia; extracting the
            required information requires looking through every Wikipedia
            article and how they're connected, and doing that live would be both
            infeasible and unkind to Wikipedia's servers.
          </p>
          <p>
            Instead, I use Wikipedia's regularly-scheduled database snapshots,
            which allow me to efficiently process every article and link to my
            heart's content. To keep the data relatively up-to-date, I update
            the snapshot used roughly every month.
          </p>
        </>
      ),
    },
    {
      question: "Why is the graph missing genres?",
      answer: (
        <>
          <p>
            The English Wikipedia doesn't capture the full breadth of the
            world's music for a variety of reasons:
          </p>
          <ul className="list-disc pl-5">
            <li>the genre is not well-known in the English-speaking world</li>
            <li>nobody has made the time to write an article about it</li>
            <li>
              it's just not notable enough to merit an entire article, or a
              section of an article
            </li>
            <li>
              it's not treated as a genre unto itself by Wikipedia: for example,
              "classical music" is too broad to be considered just one genre,
              which is why it's not represented here outside of the genres that
              descend from it.
            </li>
          </ul>
          <p>
            This isn't ideal, but it means that every genre has an article
            attached to it that you can look at for more information.
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
            I did, using my own judgement: I looked at the most relevant/most
            viewed mixes for a given genre, and then picked the mixes that
            looked like they had the most effort/love/curation. With that being
            said, however, I also consulted both my own experience and that of
            friends' to help in selecting representative mixes.
          </p>
          <p>
            My selection is not perfect; I had to make judgement calls and to
            apply my own curatorial taste, which can be difficult when I'm not
            acquainted with the genre. For genres that span multiple decades,
            I've tried to pick mixes that cover the most iconic decade, which
            means there's a bias towards mixes featuring older tracks. Sorry!
          </p>
          <p>
            Something else that's also worth touching upon: I'm an Australian
            child of the 90s, and while I've done my best to broaden my tastes,
            I recognise that I'm still very much applying a specific lens to the
            selections, despite my best efforts. I have no doubt that some of my
            selections are culturally deficient as a result.
          </p>
          <p>
            With that in mind, I'm <em>very</em> open to suggestions for new
            mixes or replacements - see the FAQ entry below on how to contact
            me!
          </p>
        </>
      ),
    },
    {
      question: "How are the top artists for each genre determined?",
      answer: (
        <>
          <p>
            For every artist on Wikipedia, I find the genres they're associated
            with, and add them to each of those genres' artist lists. I then
            score the artists for a given genre using a few metrics, including
            the number of links to the artists' article, before ranking them and
            taking the top ten.
          </p>
          <p>
            This allows me to collate the lists automatically using just
            Wikipedia data, and it works reasonably well, but it also means that
            people who are well-known for things outside of music may end up
            receiving a higher rank than is strictly relevant for that genre.
          </p>
          <p>
            This means that, for example, a celebrity that's dabbled in a
            particular genre may end up receiving a higher rank than an artist
            who's known for that genre.
          </p>
          <p>
            Unfortunately, this is the only viable solution that uses only
            Wikipedia data; in future, I may consider using other sources of
            data to help with this.
          </p>
        </>
      ),
    },
    {
      question: "How does this compare to other music mapping projects?",
      answer: (
        <>
          <p>
            I encourage you to check out other projects of a similar ilk! Here
            are the ones I'm aware of:
          </p>
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
              music, with genealogy, written-for-purpose text, references, and
              more
            </li>
          </ul>
        </>
      ),
    },
    {
      question:
        "What's the best way to reach out to you about a bug, a feature, a mix suggestion, or something else?",
      answer: (
        <p>
          If you have a GitHub account, I'd appreciate you creating an issue in{" "}
          <ExternalLink href={REPO_LINK}>
            this project's repository
          </ExternalLink>
          . Otherwise, feel free to contact me through one of the means
          mentioned on{" "}
          <ExternalLink href="https://philpax.me">my website</ExternalLink>!
        </p>
      ),
    },
  ];

  return (
    <div className="flex flex-col text-sm">
      {faqs.map((faq, index) => (
        <Collapsible
          key={index}
          title={<span className="text-left">{faq.question}</span>}
          defaultOpen={true}
          showBorder={false}
        >
          <div className="flex flex-col gap-2">{faq.answer}</div>
        </Collapsible>
      ))}
    </div>
  );
}
