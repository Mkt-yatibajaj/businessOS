# Production Checklist — Advaitum Business OS

Use this checklist before importing any real business data.

## Access and security
- [ ] Authentication works and unauthenticated visitors cannot access business records.
- [ ] First version is owner-only unless team access is required.
- [ ] RLS is enabled on every exposed table.
- [ ] RLS policies are tested using an authenticated user and an unauthenticated session.
- [ ] No service-role/secret key is present in browser code, Git history, or public environment variables.
- [ ] `.env.local` is ignored by Git.
- [ ] Errors do not reveal secrets or unnecessary personal/business data.

## Products
- [ ] SKU is unique and cannot accidentally be duplicated.
- [ ] Product can be created, edited, deactivated, searched and filtered.
- [ ] Variant/unit and category are clearly recorded.
- [ ] Product edits do not rewrite historical sale descriptions/costs.

## Purchases and inventory
- [ ] Each purchase has date, supplier, invoice/reference, currency, quantity and unit rate.
- [ ] Freight, packaging and other landed costs are allocated by a documented rule.
- [ ] Every receipt writes a stock movement.
- [ ] Physical stock adjustment requires a reason and creates an audit entry.
- [ ] Negative stock is blocked unless an explicitly approved exception is designed.
- [ ] Duplicate purchase imports are detected.

## Sales and costing
- [ ] Each sale has date, SKU, quantity, actual selling price, channel and location/event where applicable.
- [ ] Discounts, refunds, channel fees, shipping and packaging costs are recorded separately.
- [ ] Sale posting is atomic: either all sale/stock/COGS records commit, or none do.
- [ ] Cost method is explicitly selected: weighted average or FIFO.
- [ ] COGS is saved at the time of sale and cannot silently change if purchase costs later change.
- [ ] Returns and cancellations reverse the appropriate quantities and amounts; no destructive deletion of posted records.
- [ ] Duplicate order/invoice IDs are detected where applicable.

## Reports
- [ ] Date filters are tested across month/year boundaries.
- [ ] Sales totals reconcile to the sales ledger.
- [ ] Gross profit = net product revenue − COGS.
- [ ] Contribution deducts selected selling expenses separately from gross profit.
- [ ] Stock on hand reconciles to the stock movement ledger.
- [ ] Inventory valuation uses the selected costing method.
- [ ] CSV export totals match on-screen totals.

## Operations
- [ ] Build succeeds from a clean checkout.
- [ ] Mobile Chrome, laptop Chrome and tablet-sized layouts are tested.
- [ ] Empty, loading, success and error states are visible.
- [ ] Database export/backup procedure is documented.
- [ ] Restore has been tested in a separate development project.
- [ ] Owner knows how to disable access or rotate keys if a secret leaks.
- [ ] No real data is imported until all critical items are checked.

## Go-live decision
Do not treat the application as production-ready if any security, transaction integrity, inventory reconciliation or restore item is unchecked.
