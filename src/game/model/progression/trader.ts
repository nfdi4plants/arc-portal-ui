import type { Rng } from '../../contracts/rng'

// What the FAIR trader says. Every line names at least one FAIR principle (Findable, Accessible,
// Interoperable, Reusable) and ties it to the shop or to ARCs. Lines stay short, so they fit a
// speech bubble in a small dashlet.

export const FAIR_WORDS = ['Findable', 'Accessible', 'Interoperable', 'Reusable'] as const

export const TRADER_LINES = {
  greeting: [
    'Welcome to FAIR trade! Everything here is Findable, mostly because the shop is one table.',
    'Step right up! All goods Accessible. Opening hours: whenever a boss falls.',
    'Every item is Interoperable with every weapon. Results may vary.',
    'Fully Reusable gear, previously owned by a boss who no longer needs it.',
    'Fresh stock, versioned in git. Findable by commit hash, Accessible by coin.',
    'Welcome! Receipts come as RO-Crate. JSON-LD, of course. Very Interoperable.',
    'Everything on this table passed validation. Mostly. All of it is Reusable.',
    'Field notes, simulations, surveys, scans: my stock is Interoperable with all of them.',
    'Open source your research, closed source my prices. The rest is Accessible.',
    'A customer! Your annotations led you here, so I am officially Findable.',
    'Every coin is versioned. Do not ask about the merge conflicts. Stock is Reusable, though.',
    'Each item has a persistent identifier, so it stays Findable even after you drop it.',
    'All goods are tagged with ontology terms. Interoperable, and a bit shiny.',
    'Bring your research data to life, and your coins to me. Both should be Accessible.',
    'Welcome! This stall is a data scaffold plus a JSON manifest. Findable, very much so.',
  ],
  goodbye: [
    'No refunds, but everything is Reusable.',
    'Come back soon. I will be Findable next to the next portal.',
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
    'Accessible to everyone with enough coins, which right now is not you.',
    'Findable, yes. Affordable, not yet.',
    'That one is Reusable, but only after it is paid for.',
    'Open science, sure. Accessible pricing, not for that one.',
    'Interoperable with every build except one with an empty purse.',
    'Your wallet failed validation. Come back with more coins to make it Accessible.',
  ],
  unusable: [
    'That one is not Interoperable with your build right now.',
    'No free slot for that. Even Reusable things need a place to go.',
    'Your build already has that. Findable twice is still once.',
  ],
} as const satisfies Record<string, readonly string[]>

export type TraderMood = keyof typeof TRADER_LINES

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
