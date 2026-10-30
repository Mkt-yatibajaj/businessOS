# Features and limitations

## Implemented
Auth + roles, product master with categories, multi-line purchases and sales, FIFO costing with landed cost, cancellations that restore stock exactly, stock adjustments, expenses, date-range P&L, channel/product reports, CSV exports, team roles, audit log, auto numbering.

## Accounting rules
- Revenue = line totals − order discount. Cancelled sales/purchases are excluded everywhere.
- COGS = FIFO landed cost of the lots actually consumed (oldest created lot first; ordering is by entry time, not by back-dated purchase date).
- Net profit = net sales − COGS − platform fees − shipping paid − expenses. Purchases are shown separately as cash spent, not deducted again.
- Dates use India time (Asia/Kolkata).

## Not implemented
Customer-initiated partial returns/refunds (cancel the whole sale, then re-enter), GST invoices/returns and tax splits, barcode scanning, marketplace API sync (Amazon/Flipkart auto-import), multi-warehouse, attachments, automated backups, email/WhatsApp alerts, editing a posted sale/purchase (cancel + re-enter). Sales created by the original 0001 build have no lot allocation record and cannot be cancelled automatically.
