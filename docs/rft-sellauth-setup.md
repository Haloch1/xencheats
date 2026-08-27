# RFT / SellAuth setup

The storefront connects to the RFT reseller panel through its SellAuth reseller
API. The key stays server-side; it must never be placed in frontend code or
committed to Git.

## Configure Render

In the Render service environment for XenCheats, add or update:

```text
SELLAUTH_RESELLER_API_KEY=<your RFT reseller API key>
SELLAUTH_RESELLER_BASE_URL=https://api.sellauth.com/v1/reseller
SELLAUTH_CATALOG_MINUTES=30
```

Create/copy the reseller API key from the RFT panel's API/reseller settings.
Use the full key value, without quotes. If the panel gives a value prefixed by
`Bearer `, the server accepts that prefix and removes it automatically.

After saving the variables, deploy/restart the Render service. On a successful
startup the logs include:

```text
[SellAuth] Synced ... digital variant(s); reseller balance verified.
```

The live catalog is refreshed every 30 minutes by default. Admins can also use
the `/stockrefresh` Discord command to refresh both configured suppliers.

## Spoofer behavior

The Lunar, Shadow, and EAC / BE Spoofer listings now match RFT by product and
term name. RFT is tried when its live catalog and balance cover the purchase;
the existing Cheats.Love mapping remains available as a fallback. Retail
prices use the same automated markup rule as the rest of the catalog.

If the RFT catalog cannot be verified, the listing does not advertise stale
local keys. It can still use the existing Cheats.Love fallback when that route
has verified stock; otherwise it remains unavailable until a supplier route is
verified.
