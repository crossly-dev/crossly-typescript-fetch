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

## Where things are

| client | API classes | models | API reference pages |
|---|---|---|---|
| seller | `seller/src/apis/` | `seller/src/models/<area>/` | — |
| buyer | `buyer/src/apis/` | `buyer/src/models/<area>/` | — |

One class per API group (`OrdersApi`, `ListingsApi`, …), one model per type, the
models grouped one folder per product area (`vault`, `world`, `order`, …). A type
several endpoints share is ONE model, named after where it first appears
(`GetOrderResponse`, `ListOrdersItem`) or, for small shared shapes such as `{ ok }`,
after its fields (`OkResponse`). Each client README lists every method.

## Money is always cents

Every amount is an integer number of cents (`amountCents`, `totalCents`).
There are no float dollars anywhere in this API.

## Status

Every method returns a typed model. Collection endpoints return
`{ data, pagination?, meta? }` with a typed item model; single resources return
the `{ data }` envelope the API actually sends. Errors are typed everywhere.

## License

MIT
