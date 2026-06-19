## Investment Platform — Phase 1

A mobile-first investment app modeled on your screenshots (red/white theme, bottom tab nav), with full backend, admin panel, and AI-powered investment creation.

### Tech & Backend
- Lovable Cloud (Postgres + Auth + Storage + server functions)
- Lovable AI Gateway (Gemini vision) for screenshot → investment data extraction
- TanStack Start + Tailwind, shadcn components
- Admin auto-assigned to **samuelsunday09066423764@gmail.com** on first signup (DB trigger checks email → grants `admin` role)

### Database
- `profiles` (id, phone, email, full_name, avatar_url, created_at)
- `user_roles` (user_id, role: 'admin' | 'user') — separate table, security-definer `has_role()`
- `wallets` (user_id, balance, cumulative_income, total_withdrawals, team_size)
- `investments` (id, name, image_url, price, cycle_days, daily_income, total_income, description, category: 'welfare'|'product', is_active, sort_order)
- `user_investments` (id, user_id, investment_id, quantity, purchased_at, last_collected_at, status)
- `transactions` (id, user_id, type: 'recharge'|'withdraw'|'invest'|'income', amount, status, meta, created_at)
- `banners` (id, key: 'hero'|'lucky_draw'|..., image_url, title, subtitle, link, sort_order) — every visual banner editable from admin
- `site_settings` (key, value) — for logo, support badge image, etc.
- Storage buckets: `investment-images`, `banners`, `avatars` (public read; admin write)

### Pages — User App
1. **/auth** — combined Login / Register tabs (phone + password, optional email, referral code)
2. **/** Dashboard — balance card, action grid (Message/Free Cash/Cash Benefits/Certificate/FAQ), Lucky Draw banner, Welfare Product hero, bottom nav
3. **/products** — Product Center list (Compact car, Mid-size, etc.)
4. **/investment/$id** — full details page with image hero, price/total card, cycle/quantity/daily rows, description, "Invest now" bottom sheet confirmation
5. **/wallet** — balance, stats grid, menu (Bank card, Lucky draw, Free cash, Balance bill, Recharge record, Withdrawal record)
6. **/orders** — user's active investments
7. **/team** — referral team
8. **/chat** — support placeholder

### Pages — Admin (`/admin/*`, gated by `has_role('admin')`)
- **Dashboard** — users, total invested, pending withdrawals
- **Investments** — list, create, edit, delete, reorder
- **AI Create Investment** — upload screenshot → server fn calls Gemini Vision → returns `{name, price, cycle_days, daily_income, total_income, description}` → prefilled form → admin reviews, uploads cover image, posts
- **Banners** — edit each banner image/title (Lucky Draw, Welfare hero, etc.)
- **Users** — list, adjust balance, grant/revoke admin
- **Transactions** — approve/reject recharges & withdrawals

### AI Screenshot Extraction
Server function `extractInvestmentFromImage` posts the uploaded image (base64) to `google/gemini-3-flash-preview` with a JSON-schema prompt. Result populates the admin form; admin then uploads the final investment cover image and submits.

### Out of scope (later phases)
Lucky draw game logic, referral commission engine, real payment gateway (recharge/withdraw will be manual-approval queues), chat messaging, certificates, push notifications.

### After approval I will
1. Enable Lovable Cloud
2. Create migrations (tables, roles, admin-bootstrap trigger, storage buckets, RLS, grants)
3. Build design system (red `#E63946` primary, white surfaces, dark wallet card)
4. Build auth → user pages → admin pages → AI extraction last
