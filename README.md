# Every Deck

Every one of the **52! = 80,658,175,170,943,878,571,660,636,856,403,766,975,289,505,440,883,277,824,000,000,000,000** orderings of a standard deck of playing cards, addressable by a single integer.

No database. Nothing is precomputed or stored. Any deck is reconstructed from its address on demand, in the browser.

## The idea

A deck ordering is a permutation of 52 card IDs. Every permutation has a Lehmer code: at each position, record how many still-unplaced cards were smaller than the card chosen. Weight that digit by its factorial position and sum:

$$ \text{rank}(p) = \sum c_i \cdot (51 - i)! $$


The effective radices are 52, 51, …, 2, so every index in `[0, 52!)` names exactly one deck and every deck has exactly one index. 52! is 68 decimal digits (226 bits), so every index is stored as a `BigInt`.

## How it works

1. A deck is 52 cards in a particular order.
2. Every possible order can be written as one large number. That number always rebuilds the same order.
3. The app reads the number, builds the deck in your browser, and draws it. There is no database and no saved list of decks.
4. The ruler, step buttons, and index box change the number. Grid, Fan, and Piles are just three ways to draw the same deck.
5. A shared link carries the number, so the same deck opens for anyone who clicks it.

## Getting started

Requires Node.js 22 (see `.nvmrc`).

```bash
git clone https://github.com/MohammadSameer19/everydeck.git
cd everydeck
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the development server        |
| `npm run build`     | Create a production build           |
| `npm start`         | Serve the production build          |
| `npm test`          | Run the Vitest suite                |
| `npm run test:math` | Verify the framework-free math core |
| `npm run typecheck` | Type-check with `tsc --noEmit`      |
| `npm run format`    | Format with Prettier                |

## URLs

A shared link can address a deck in two forms:

```text
?deck=S2H3D4C5…S3S2     104 characters, human-readable
#39445782035834…        68 digits, the canonical integer
```

`?deck=` wins when both are present. The URL is kept in sync with `replaceState`; index fragments are read once on load.

## Project structure

```text
app/          Next.js app shell and global styles
components/   React interface; renders and animates
hooks/        Scroll and keyboard navigation
lib/          Framework-free math core
tests/        Vitest + fast-check
scripts/      Standalone math verification
```

The dependency direction is one-way: `components/` may import `lib/`, never the reverse.

## Testing

```bash
npm test
npm run test:math
npm run typecheck
```

The math core has no React, Next.js, or DOM dependency, so `npm run test:math` can verify it directly under `tsx`.

## License

MIT — see [LICENSE](LICENSE).
