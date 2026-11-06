import DeckExplorer from "@/components/DeckExplorer";
import { LAYOUT_VIEWS } from "@/lib/layouts";
import { TOTAL } from "@/lib/factorials";
import {
  DECK_PARAM,
  VIEW_PARAM,
  resolveState,
  type ViewName,
} from "@/lib/urlState";
import { DeckError } from "@/lib/validation";

/**
 * The landing page resolves a URL into a concrete deck and hands it to the
 * client. Server-side resolution means a shared link renders the right deck
 * on the first paint, rather than flashing the default and correcting
 * itself once hydration finishes.
 *
 * Next 15+ makes `searchParams` a Promise; the fragment is never sent to the
 * server, so it is read on the client after mount.
 */

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;

  const raw = params[DECK_PARAM];
  const deckParam = Array.isArray(raw) ? raw[0] : raw;

  const rawView = params[VIEW_PARAM];
  const viewParam = Array.isArray(rawView) ? rawView[0] : rawView;

  let state;
  try {
    state = resolveState({ deck: deckParam, view: viewParam });
  } catch (error) {
    if (error instanceof DeckError) {
      return <InvalidDeck error={error} raw={deckParam ?? ""} />;
    }
    throw error;
  }

  const view = (LAYOUT_VIEWS as readonly string[]).includes(state.view)
    ? (state.view as ViewName)
    : "grid";

  return (
    <DeckExplorer
      initialIndex={state.index}
      initialDeck={state.deck}
      initialView={view}
    />
  );
}

function InvalidDeck({ error, raw }: { error: DeckError; raw: string }) {
  const showRaw = raw.length > 0 && raw.length <= 120;

  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-6 py-16">
      <div className="border-rule bg-raised w-full max-w-xl border px-6 py-7">
        <h1 className="text-ink font-serif text-lg font-medium">
          That link doesn&rsquo;t name a deck
        </h1>

        <p className="text-muted mt-2 font-serif text-[13px] leading-relaxed">
          {error.message}
        </p>

        {showRaw && (
          <p className="text-muted/70 mt-3 font-mono text-[11px] break-all">
            /?deck={raw}
          </p>
        )}

        <p className="text-muted mt-4 text-[12px] leading-relaxed">
          A deck link carries 104 characters &mdash; 52 cards, two characters
          each, like <code className="text-accent">S2H3D4C5&hellip;</code>.
          Suits are S, H, D, C; ranks are 23456789TJQKA.
        </p>

        <p className="text-muted mt-2 text-[12px] leading-relaxed">
          Or an index link is just the digits:{" "}
          <code className="text-accent">
            /#3944578203583403134320130688&hellip;
          </code>
          . There are {TOTAL.toString().length} of them in total.
        </p>

        <a
          href="/"
          className="border-rule text-ink hover:border-ink mt-5 inline-flex items-center border px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors"
        >
          Start from the sorted deck
        </a>
      </div>
    </main>
  );
}
