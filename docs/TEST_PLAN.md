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
