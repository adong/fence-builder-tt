/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: FB.TITLE,
  cols: ['Teddy', 'Tommy'],
  keys: [
    ['walk along the garden edge', 'W A S D', '← ↑ → ↓'],
    ['build a fence (hold, and step into the field)', 'Space', 'Enter or /'],
    ['build slowly: double points (hold)', 'L-Shift or Q', 'R-Shift or .'],
    ['call your brother · high five', 'T', 'T'],
    ['pause · sound', 'P or Esc · M', ''],
  ],
  note: '1 player: either set of keys works. Walk back along your fence to roll it up again.',
  touch: 'The pad moves you. Hold BUILD (or 🐢 SLOW) and step off the garden to build a fence. 2 players: Teddy has the pad on the left, Tommy the one on the right. The round face button (top right) calls your brother.',
});
