# Features and limitations

## Implemented in this source
- Supabase email/password login and sign-out.
- Middleware session refresh and redirect of anonymous visitors to login.
- Profile role read; viewer role is read-only in the UI. Database permissions are authoritative.
- Product master: create and list SKU, name, unit, selling price and reorder threshold.
- Purchase posting: one SKU per purchase; quantity, unit purchase rate, purchase date and extra lot cost.
- FIFO lots: each purchase is an individual cost lot; extra cost is allocated per unit.
- Sales posting: one SKU per sale; channel, date/time, location, quantity and price.
- Atomic FIFO sale posting with row locks and insufficient-stock rejection.
- Stock movement and audit records written in the same transaction.
- Inventory summary view with on-hand stock and stock valuation.
- Dashboard revenue, COGS and gross profit from the latest 100 sales; inventory CSV export.

## Not implemented; do not assume available
- Multi-line purchase/sales invoices.
- Returns, refunds, cancellations and purchase returns.
- Stock adjustments, damages and physical stocktake UI.
- Supplier/category management screens.
- Expenses, settlement reconciliation, tax/GST accounting or statutory reports.
- Full historical date-range reporting or pagination beyond latest 100 sales/purchases.
- User invitation and role-management interface.
- Attachments, invoice upload, barcode, integrations or automated backups.
- Multi-company / multi-location stock accounting.

## Accounting interpretation
Purchase extra cost is allocated entirely to the single received lot on a per-unit basis. Sales use FIFO by lot creation time. Gross profit here is net line revenue less FIFO COGS; selling fees and shipping are stored only if extended at the SQL/API level and are not currently entered in the UI. This is not a full net-profit calculation.
