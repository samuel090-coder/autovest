# Referral tracking + clean recharge flow

## What's wrong today

1. **Referrals are invisible.** The data is stored correctly (each new account records who invited them), but the privacy rules only let a person read their *own* profile row. So the Team page counts referrals it is not allowed to read, and always shows 0 — even when the referral exists.
2. **No welcome banner** for someone who joins through an invite link, and **no alert** to the person who invited them.
3. **Deposits are created too early.** Tapping "Pay ₦X" on the Recharge page immediately records a pending deposit, before the person has seen the bank details or transferred anything. Abandoning, going back, or retrying leaves fake pending deposits behind.

## What will change

### 1. Referral page (new `/referrals`, Team page keeps working)
A dedicated page showing, for the signed-in person only:
- Total invited, valid (deposited) referrals, pending referrals, and referral earnings.
- A list of each invited person: masked name/phone, join date, and a status chip — **Pending Deposit** or **Valid Referral**, plus the bonus earned from them.
- Invite link and code with copy/share, reusing the existing share sheet.

Because privacy rules block direct reads, the list is served by a secure database routine that only ever returns the caller's own referrals. Contact details are masked (e.g. `Sam***`, `0803****210`).

The existing Team page gets its correct counts from the same routine and links through to the new page.

### 2. "You've been referred" banner for the new user
On first visit after signing up through an invite link, an animated, branded modal appears: *"You've Been Referred! 🎉 You joined through [Name]'s referral link."* plus an encouraging line and a **Deposit & Invest** button going to Recharge. Shown once, then remembered.

### 3. Private alert to the inviter
The moment someone registers with an invite code, the inviter (and only the inviter) gets an in-app notification and, if they enabled phone alerts, a push: *"Someone used your referral link! 🎉 [Name] has joined… ask them to make a deposit to make the referral valid."* It links to the referral page. This rides on the existing notification system, so no new delivery code.

### 4. Registration vs. qualification
Registering shows up immediately as **pending**. It only becomes **valid** when a deposit is actually approved — the existing 20% bonus rule stays exactly as it is. A safeguard is added so one deposit can never pay the bonus twice (unique link between a deposit and its bonus record), and the inviter gets a second notification when the referral turns valid.

### 5. Recharge: nothing is recorded until the person confirms payment
- Choosing an amount and tapping continue now only opens the payment screen with the bank details — **no deposit record is created**.
- The deposit record is created at the moment the person taps **"I have made the payment"**, which is when they claim a transfer was made.
- Going back, refreshing, changing the amount, or closing the screen creates nothing.
- Double-tapping is protected: the button locks while saving, and a repeat within the same session reuses the same deposit instead of creating a second one.
- Everything after that is untouched: support issues the token, the token confirms the deposit, wallet credit and admin approval work exactly as before.

## Technical notes

- New migration: `get_my_referrals()` + `get_my_referral_stats()` + `get_my_referrer()` (SECURITY DEFINER, scoped to `auth.uid()`, masked output, granted to `authenticated`); referral-signup notification inside `handle_new_user`; referral-valid notification and a `UNIQUE (source_transaction_id)` index on `referral_earnings`; an `idempotency_key` in transaction meta with a partial unique index over pending recharges.
- `src/routes/recharge.tsx`: remove the insert; navigate to `/payment/new?amount=…`.
- `src/routes/payment.$id.tsx`: accept `id === "new"`, read amount from the URL, create the transaction on the step‑1 confirm button, then `navigate({ replace: true })` to the real id.
- New `src/routes/referrals.tsx`, new `src/components/referred-welcome.tsx` mounted in `__root.tsx`.
- No changes to auth, payment tokens, wallet crediting, admin approval, or the push pipeline.
