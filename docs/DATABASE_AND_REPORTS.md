# Database, Inventory and Reporting Design

## Suggested core tables
- `profiles`: authenticated user profile and role.
- `categories`: product category list.
- `products`: stable SKU, name, variant, unit, status and default selling price.
- `suppliers`: supplier details.
- `purchases`: purchase header (supplier, date, invoice, other costs, status).
- `purchase_items`: product, quantity, unit rate and allocated landed cost.
- `inventory_lots`: received quantity, remaining quantity and unit cost when using FIFO.
- `sales`: sale header (date, channel, location/event, order reference, discounts, fees, shipping and status).
- `sale_items`: product, quantity, actual unit price, discount, COGS captured at posting.
- `stock_movements`: append-only stock movement ledger.
- `expenses`: business expenses not attached to a single sale.
- `audit_log`: who changed what and when.

Treat this as a design proposal, not a claim that all these tables are already implemented in the starter SQL.

## Inventory ledger rules
Do not use a manually editable `stock` number as the only source of truth. Derive on-hand stock from the movement ledger or maintain a cached balance that is updated transactionally.

Movement examples:
- Purchase receipt: positive quantity.
- Sale: negative quantity.
- Customer return: positive quantity after return acceptance.
- Damage/write-off: negative quantity with reason.
- Stock count adjustment: signed quantity with reason and user audit record.

Posted transactions should be reversed by a linked return/cancellation/adjustment record rather than deleted.

## Costing method
Pick one method before importing historical records.

### Weighted average
Average unit cost = total cost value of available inventory / available quantity, recalculated under a documented policy after receipts. Ensure a sale stores the COGS used at the time it was posted.

### FIFO
Each receipt creates a lot. A sale consumes the oldest available lot first. The database transaction must update remaining lot quantities and write the cost allocation per sale line.

Do not mix FIFO and weighted-average calculations in the same report.

## Sale posting must be atomic
Use a PostgreSQL function or transaction that:
1. Validates authenticated user and permissions.
2. Locks/validates relevant stock rows to prevent two simultaneous sales overselling stock.
3. Validates SKU, quantity, price, discount and sale status.
4. Calculates COGS using the chosen method.
5. Writes sale header and line items.
6. Writes stock movements and cost allocations.
7. Commits all writes together, or rolls back all writes if any step fails.

Do not implement stock deduction as a sequence of unrelated browser requests.

## Report definitions
- Net product revenue = line amount − discounts − refunds, with shipping collected reported separately.
- COGS = COGS recorded on posted sale lines, adjusted for returns under the defined return policy.
- Gross profit = net product revenue − COGS.
- Gross margin % = gross profit / net product revenue × 100 (show `—` when revenue is zero).
- Contribution = gross profit − directly attributable channel fees − packaging/shipping costs.
- Inventory value = remaining inventory valued under the selected costing method.
- Sales by channel/location = sum of posted sales for the selected date range, excluding voided/cancelled records under documented rules.

## Import strategy
1. Prepare a spreadsheet with one row per purchase line and one row per sale line, plus transaction header fields.
2. Keep original invoice/order references.
3. Validate dates, SKU codes, quantities and currency values.
4. Detect duplicates before insert.
5. Import into a development database first.
6. Reconcile imported totals against source records.
7. Keep a copy of the original source file and an import summary.
