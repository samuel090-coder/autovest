# Moving offer banner and animated investment progress

## Build
- Replace the floating “Earn ₦500,000” badge with a slim, clickable LED ticker fixed at the top of signed-in pages, without changing the offer destination or authentication rules.
- Make every active order card open a dedicated running-investment page.
- Add a mobile-first Android-style running-investment view with the plan summary above, a large upright battery in the center, animated green money falling inside it, and the battery fill tied to live investment progress.
- Show timing, round, earned amount, daily income, total income, and status below the battery while preserving the existing next-round and payout actions.
- Add route-specific sharing metadata and keep all visual colors in the existing design system.

## Technical details
- Add a typed `/orders/$id` route and navigate with TanStack Router links and params.
- Query only the signed-in user’s matching investment so private records remain user-scoped.
- Reuse the current progress calculation and existing `start_next_round` / `claim_investment` calls; no backend or payout rule changes.
- Add reduced-motion-safe CSS animations for the LED ticker, money rain, battery glow, and charging pulse.
- Verify the route on mobile and desktop, plus check preview errors and the central click-through flow.
