# Domain setup

Do not change DNS or the Vercel project from this repo. These are the records and steps for when Nicholas is ready.

The marketing site stays at [https://www.weareonehope.com/](https://www.weareonehope.com/). The app and API are planned for `app.weareonehope.com`. Until that DNS is live, `PUBLIC_BASE_URL` stays `https://onehope-beryl.vercel.app`.

## DNS

At the DNS host for `weareonehope.com`:

| Type  | Name  | Value                  |
| ----- | ----- | ---------------------- |
| CNAME | `app` | `cname.vercel-dns.com` |

Leave `www` and the apex pointed wherever the marketing site already lives. Do not replace those records with this CNAME.

## Vercel

1. In the One Hope Vercel project, add the domain `app.weareonehope.com`.
2. Wait until Vercel shows the domain as valid.
3. Set the environment variable `PUBLIC_BASE_URL` to `https://app.weareonehope.com` (no trailing slash) and redeploy.
4. Leave it unset until then. The code defaults to `https://onehope-beryl.vercel.app`.

Share links, the invite page, and plan-a-visit links on the app use `PUBLIC_BASE_URL`. The church website can link to:

- `https://app.weareonehope.com/invite`
- `https://app.weareonehope.com/visit`
- `https://app.weareonehope.com/coffee`
- `https://app.weareonehope.com/neighborhood`
- `https://app.weareonehope.com/member`

## Cookies and CORS

Cookies are host-only (`SameSite=Lax`, `Secure` when the public URL is https). They are not set on `.weareonehope.com`, so a session on the app is not sent to the marketing site.

The API allows browser calls from:

- the `PUBLIC_BASE_URL` origin
- `https://www.weareonehope.com`
- `https://weareonehope.com`
- `https://app.weareonehope.com`
- local `http://localhost:3000` and `http://127.0.0.1:3000`

## iPhone universal links

The app entitlements include:

- `applinks:onehope-beryl.vercel.app`
- `applinks:app.weareonehope.com`

The server answers `/.well-known/apple-app-site-association` for the app id `GDNRT9DJ58.com.cinderandcrown.onehope` on `/invite`, `/visit`, `/coffee`, `/neighborhood`, and `/member`.

After DNS is live, open those paths once on a phone so Apple can fetch the file. No remote push is turned on.
