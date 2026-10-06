# Roadmap

- [x] Confirm backend fully resumed (was paused; now healthy)
- [x] Fix: user balance not debited when balance is used — root cause: users had no wallet UPDATE permission; added atomic purchase_investment + debit_wallet DB functions, wired invest + withdraw flows
- [x] Admin deduct/credit any wallet — admin_adjust_wallet DB function (audit transaction + user notification), UI on admin user detail page and users list
- [x] Declined: auto-wiping user balances for inactivity — explained to user
- [x] Move Earn ₦500,000 offer into a clickable top LED ticker
- [x] Add clickable order cards and an animated live investment battery page
- [ ] Restore reliable signed-in IP, location, device, browser, device ID, and user-agent capture; verify admin display
