# RFT Seller API setup

The storefront connects directly to RFT's native Seller API. RFT is not a
SellAuth reseller account. The key stays server-side; it must never be placed
in frontend code or committed to Git.

## Configure Render

In the Render service environment for XenCheats, add or update:

```text
RFT_SELLER_API_KEY=<your RFT Seller API key>
RFT_API_BASE_URL=https://api.reselling.pro/rft
RFT_SELLAUTH_CATALOG_MINUTES=30
RFT_EXACT_STOCK_MINUTES=5
RFT_STOCK_COUNT_CEILING=100
RFT_REQUESTS_PER_MINUTE=36
```

Copy the key shown under **Settings → API Keys → Seller API Key**. Use the full
key value without quotes. The old `RFT_SELLAUTH_RESELLER_API_KEY` variable is
still accepted so existing Render deployments continue working, but the server
now routes it only to RFT's native API. A stale
`RFT_SELLAUTH_RESELLER_BASE_URL=https://api.sellauth.com/v1/reseller` value is
automatically corrected to RFT's API host.

Keep `SELLAUTH_RESELLER_API_KEY` and `SELLAUTH_RESELLER_BASE_URL` for Ghostware.
Ghostware and RFT are synchronized independently and their credentials are
never sent to the other service. Ambiguous duplicate Ghostware product names
are skipped instead of guessing which game they belong to.

After saving the variables, deploy/restart the Render service. On a successful
startup the logs include:

```text
[RFT] Synced ... digital variant(s) through the native Seller API.
```

The lightweight catalog mapping refreshes every 30 minutes. Opening a product
refreshes only that product's exact key counts at most once every five minutes.
All RFT requests share a capped queue (36/minute by default), and duplicate
page/cart checks are coalesced. RFT's stock endpoint does not claim keys.
Admins can also use the `/stockrefresh` Discord command to refresh configured
sources.

## Spoofer behavior

The Lunar, Shadow, and EAC / BE Spoofer listings match RFT by product and term
name. RFT is tried when its live stock covers the purchase; the existing
Cheats.Love mapping remains available as a fallback. Retail prices use the same
automated markup rule as the rest of the catalog.

If the RFT catalog cannot be verified, the listing does not advertise stale
local keys. It can still use the existing Cheats.Love fallback when that route
has verified stock; otherwise it remains unavailable until a supplier route is
verified.
