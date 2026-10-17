# PEPTORA storefront integration

`js/store-feed.js` projects `data/lotes.json` into `data/store-offers.json`, containing only retail MXN prices and unconsigned stock by exact storefront presentation. No costs, suppliers, commissions, customer records or credentials are exported. Initial correction authorized by owner: Ipamorelin lot_010 100 mg → 10 mg, price/units unchanged.

Lot creation, lot editing/deletion, quick sales, cancellations, consignments and returns use `ghGuardarAtomico`: lot data and the public projection are written in **one commit** with optimistic concurrency and non-forced ref updates. A WhatsApp inquiry never decrements inventory; confirm sales using the existing inventory sales workflow. Direct manual GitHub edits of lot JSON bypass this application hook and require regenerating the projection; use the inventory UI for operational changes.

Price rule: newest acquisition date among unexpired lots with a positive retail price; tied dates use the last row in inventory order. Available units sum unexpired matching lots; stock already assigned to consignments is not counted a second time. Legacy boxes are normalized at 10 vials unless explicitly configured otherwise. Unmatched presentations stay under order, with no guessed prices.

Unmapped pending identity confirmation: CJC-1295 inventory lacks DAC designation; Tesamorelin/Ipamorelin and BPC/TB inventory records have concentration 0 with no component amounts. SS-31, glutathione and CJC/Ipamorelin have no matching inventory record. Map only verified presentations in `js/store-feed.js`.

Store reads the public feed from raw.githubusercontent.com (CORS enabled), on load, window focus and every minute. GitHub CDN propagation may add delay. This is a retail availability view, not a checkout reservation system. Failed fetches clear price/availability rather than showing stale stock. Spanish uses MXN. English uses rounded per-unit `MXN / 18.2 + 5` USD; cart totals sum those unit prices.

Tests: `node store-feed.tests.cjs` and `node store-atomic.tests.cjs`; they use synthetic data and no real stock writes.

