import type { Rng } from '../../contracts/rng'

// What the FAIR trader says. Every line names at least one FAIR principle (Findable, Accessible,
// Interoperable, Reusable) and ties it to the shop or to ARCs. Lines stay short, so they fit a
// speech bubble in a small dashlet.

export const FAIR_WORDS = ['Findable', 'Accessible', 'Interoperable', 'Reusable'] as const

// The trader's story. The ontologies broke into pieces, and the mobs are made from them. He collects
// the Ontology Fragments to put every ontology back together and make the world a FAIRer place.
// About a third of the lines of each mood tell it, so it comes up now and then, not every time.
export const TRADER_LORE = {
  greeting: [
    'Each fragment is a term someone forgot to link. Rebuilt ontologies keep the world Findable.',
    'Ontology Fragments! The mobs shed them. I glue them back into ontologies, Interoperable again.',
    'Welcome! I take Ontology Fragments. Each one brings a broken ontology closer to Reusable.',
    'The ontologies shattered and mobs grew from the pieces. Bring me fragments, keep it Findable.',
    'Got fragments? I am rebuilding the ontologies, term by term, until the world is Interoperable.',
    'One more fragment and this ontology is whole again. Then its terms are Accessible to everyone.',
    'A FAIRer world needs whole ontologies. Trade me your fragments, the cards are Reusable.',
  ],
  goodbye: [
    'Thanks for the fragments. One shard at a time, the ontologies become Findable again.',
    'Off you go! Bring back fragments. A whole ontology makes every term Interoperable.',
    'Mobs with an ontology term carry more fragments. The well-annotated ones are Findable, too.',
    'Farewell! Each fragment you bring makes the world a little more Reusable, and a lot FAIRer.',
    'Safe travels. Every term you link is one ontology fragment less to glue. Keep it Accessible.',
    'Bye! My ontology puzzle is almost Interoperable again. Only a few thousand fragments to go.',
    'Go well. Once the ontologies are whole, every annotation is Findable. Bring fragments!',
  ],
  bought: [
    'Sold! Your fragments go straight into the ontology. It is nearly Interoperable again.',
    'Deal! Your fragments filled a gap in the ontology. The world got a bit more Findable.',
    'Thank you! With these fragments the ontology is Reusable by everyone again.',
  ],
  poor: [
    'Not enough fragments yet. Ontologies are not rebuilt in a day, not even Accessible ones.',
    'A few fragments short. Mobs with ontology terms carry more of them. A Findable tip.',
    'I need whole fragments for that, not promises. The ontology has to stay Interoperable.',
  ],
  unusable: ['Keep your fragments for something that fits. The ontology waits, Reusable as ever.'],
} as const satisfies Record<string, readonly string[]>

const TRADE_LINES = {
  greeting: [
    'Welcome to FAIR trade! Everything here is Findable, mostly because the shop is one table.',
    'Step right up! All goods Accessible. Opening hours: whenever a boss falls.',
    'Every item is Interoperable with every weapon. Results may vary.',
    'Fully Reusable gear, previously owned by a boss who no longer needs it.',
    'Fresh stock, versioned in git. Findable by commit hash, Accessible by fragment.',
    'Welcome! Receipts come as RO-Crate. JSON-LD, of course. Very Interoperable.',
    'Everything on this table passed validation. Mostly. All of it is Reusable.',
    'Field notes, simulations, surveys, scans: my stock is Interoperable with all of them.',
    'Open source your research, closed source my prices. The rest is Accessible.',
    'A customer! Your annotations led you here, so I am officially Findable.',
    'Every fragment is versioned. Do not ask about the merge conflicts. Stock is Reusable, though.',
    'Each item has a persistent identifier, so it stays Findable even after you drop it.',
    'All goods are tagged with ontology terms. Interoperable, and a bit shiny.',
    'Bring your research data to life, and your fragments to me. Both should be Accessible.',
    'Welcome! This stall is a data scaffold plus a JSON manifest. Findable, very much so.',
  ],
  goodbye: [
    'No refunds, but everything is Reusable.',
    'Come back soon. I will be Findable at the next waystation.',
    'Interoperable with all weapons. Terms and conditions are in a README nobody reads.',
    'Safe travels. Keep your metadata Accessible and your health bar full.',
    'Cite this shop, it has a DOI now. Findable forever, whether it likes it or not.',
    'Farewell! Data nobody shares is data nobody finds Reusable.',
    'Off you go. Connect your research data to the world, and keep it Accessible.',
    'Bye! Commit your changes, push your gear. Everything is Reusable after a git pull.',
    'See you at the next node. I am the Findable one with the table.',
    'Leaving already? The exit is Accessible and fully documented.',
    'Take care! Your build is now more Interoperable than most spreadsheets.',
    'Publish without pausing research, and keep it Reusable. Bye!',
    'Good luck out there. A citable data publication awaits you, Findable forever.',
    'Thanks for keeping trade FAIR, and your provenance Accessible.',
    'Remember: validate early. My stock is Reusable, your health is not.',
  ],
  bought: [
    'Sold! Now Reusable in battle.',
    'Your purchase passed validation. Mostly. Interoperable anyway.',
    'Receipt saved as RO-Crate. Findable forever.',
    'Versioned and tagged. Accessible from your build panel.',
    'A fine choice. Interoperable with your whole build.',
    'Deal! Committed to your build, no rebase needed. Fully Reusable.',
    'Pushed to your DataHUB. Accessible at once.',
  ],
  poor: [
    'Accessible to everyone with enough fragments, which right now is not you.',
    'Findable, yes. Affordable, not yet.',
    'That one is Reusable, but only after it is paid for.',
    'Open science, sure. Accessible pricing, not for that one.',
    'Interoperable with every build except one with an empty purse.',
    'Your purse failed validation. Come back with more fragments to make it Accessible.',
  ],
  unusable: [
    'That one is not Interoperable with your build right now.',
    'No free slot for that. Even Reusable things need a place to go.',
    'Your build already has that. Findable twice is still once.',
  ],
} as const satisfies Record<keyof typeof TRADER_LORE, readonly string[]>

export type TraderMood = keyof typeof TRADER_LORE

// Every line per mood, the story lines last.
export const TRADER_LINES: Record<TraderMood, readonly string[]> = {
  greeting: [...TRADE_LINES.greeting, ...TRADER_LORE.greeting],
  goodbye: [...TRADE_LINES.goodbye, ...TRADER_LORE.goodbye],
  bought: [...TRADE_LINES.bought, ...TRADER_LORE.bought],
  poor: [...TRADE_LINES.poor, ...TRADER_LORE.poor],
  unusable: [...TRADE_LINES.unusable, ...TRADER_LORE.unusable],
}

// Picks lines at random and never the same line twice in a row.
export function createLinePicker(lines: readonly string[], rng: Rng): () => string {
  let last = -1
  return () => {
    if (lines.length <= 1) return lines[0] ?? ''
    // After the first line, draw from the others by skipping over the last index.
    let index = last < 0 ? rng.int(0, lines.length - 1) : rng.int(0, lines.length - 2)
    if (last >= 0 && index >= last) index += 1
    last = index
    return lines[index]
  }
}
