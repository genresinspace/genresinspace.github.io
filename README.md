<div align="center">
    <img alt="genresin.space" src="assets/icon.png" width="20%">
    <h1><a href="https://genresin.space">genresin.space</a></h1>
</div>

A graph of every music genre on English Wikipedia, inspired by
[8831](https://eightyeightthirty.one/) and [musicmap](https://musicmap.info/).

Uses a Rust data processor to extract music genres from
[a Wikipedia dump](https://dumps.wikimedia.org/enwiki/) to produce data for the frontend website
to use.

The frontend website uses React and a custom WebGL2 graph renderer with a
pre-calculated force-directed layout. This project originally used
[Cosmograph](https://cosmograph.app/) for graph rendering, but moved away from
it due to [a WebGL issue on Apple devices that led to node collapse](https://github.com/cosmosgl/graph/issues/62);
this issue was resolved for iOS, but still occurs on iPadOS.
The custom solution has the added benefit of not requiring the users to simulate the graph,
improving load-in time, performance, and consistency.

For more information, see my blog post (TODO).
