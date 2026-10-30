# Manual acceptance test plan

Use a test SKU and test-only transaction references. Do not test with live orders.

1. Visit `/` in a private/incognito browser. Expected: redirect to `/login`.
2. Sign in as owner. Expected: workspace loads; role displays owner.
3. Sign out. Expected: return to login; browser back must not expose protected data.
4. Create SKU `TEST-FIFO-001`, unit `piece`, selling price 100. Refresh. Expected: product remains in catalogue.
5. Purchase 5 units at ₹40 with ₹10 extra lot cost. Expected lot unit landed cost ₹42; stock 5; stock value ₹210.
6. Purchase 3 units at ₹50 with no extra cost. Expected stock 8; stock value ₹360.
7. Sell 6 units at ₹100 through Offline. Expected FIFO COGS ₹260; remaining stock 2; stock value ₹100; line gross profit ₹340.
8. Attempt to sell 3 more units. Expected: RPC error for insufficient stock; no sale header/item/stock movement persisted.
9. Refresh dashboard and verify transactions persist.
10. Sign in as viewer (test account with role viewer). Expected: reads available; create/post buttons disabled; RLS rejects attempted writes.
11. Test anonymous API access. Expected: no business data returned.
12. Run `npm run typecheck`, `npm run lint`, and `npm run build` from a clean install. Record actual results before go-live.

Expected calculations assume the purchase lot extra cost is allocated evenly across its units and FIFO consumes the oldest lot first. A successful local build does not replace live Supabase/RLS testing.

## Additional checks for 0002 (automated version: `supabase/test_scenarios.sql`)
13. Multi-line sale where the second product is out of stock. Expected: error, first line's stock NOT deducted.
14. Cancel a sale as admin/owner. Expected: stock and valuation return to pre-sale values; sale shows Cancelled and drops out of Reports.
15. Cancel a purchase whose stock was partly sold. Expected: rejected with explanation.
16. Stock adjustment "Damage 2". Expected: stock −2 at FIFO cost, movement logged with reason.
17. Add a ₹50 expense. Expected: Reports net profit drops by ₹50.
18. As operator: Cancel buttons and Team page are hidden; as viewer: forms hidden.
All of 5-8, 13-17 were verified against a local PostgreSQL 16 before delivery; the UI was type-checked, linted and production-built, but NOT clicked through against a live Supabase project.
