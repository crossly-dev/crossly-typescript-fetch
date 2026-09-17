# Crossly typescript-fetch SDK

> **Generated.** Source of truth is the OpenAPI spec in the Crossly monorepo.
> Pull requests editing this code can't be merged — fix the spec, regenerate.

## Two clients, two principals

| directory | API | credential |
|---|---|---|
| `seller/` | store: listings, crossposting, orders, analytics | Personal Access Token (`crossly_pat_…`) or seller OAuth |
| `buyer/` | shopping: cart, orders, wishlists, offers, cashback | buyer OAuth (`crossly_oat_…`), `buyer:*` scopes |

They are **not** interchangeable. A seller token does not authenticate the buyer
API and vice versa — same person, one Crossly account, two principals. Using the
wrong one gives you a 401 from a subsystem that will not explain why.

## Money is always cents

Every amount is an integer number of cents (`amountCents`, `totalCents`).
There are no float dollars anywhere in this API.

## Status

Collection endpoints return `{ data, pagination?, meta? }` and have typed item
models. Non-collection endpoints mostly return an untyped map for now — the
envelope and the error type are typed everywhere.

## License

MIT
