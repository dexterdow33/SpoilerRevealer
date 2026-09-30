# NewHampshirights

A members-only social platform for verified New Hampshire residents. Six sections: Government, Marketplace, Discussion, Information, Help, Sharing. Nobody reads or posts until a moderator has checked their ID.

Status: working prototype (v0.1). Runs locally. Not ready for public launch until the checklist at the bottom is done.

## Run it

Requires Node.js 22.13 or newer (uses the built-in `node:sqlite`).

```bash
cd newhampshirights
npm install
npm start                                  # http://localhost:3000
```

Make yourself a moderator: sign up on the site, then

```bash
npm run make-admin -- you@example.com
```

Run the tests: `npm test`

Settings (environment variables): `PORT`, `DATA_DIR` (database and private uploads, default `./data`), `SITE_NAME`, `SITE_DOMAIN`, `NODE_ENV=production` (turns on secure cookies; run behind HTTPS).

## What it does

| Area | Details |
|---|---|
| Accounts | Email + password (scrypt hash), display name, town, county. 18+ and NH-residency attestation at signup. |
| Verification | Upload ID front, optional back, a selfie holding the ID, and a proof of NH address when the ID is a passport. A moderator reviews and approves or rejects. |
| Access | Logged-out visitors see only the landing page and policy pages. Unverified accounts see only the verification page. All content is members-only and marked `noindex`. |
| Posting | Posts in any of the six sections, tagged by county. Marketplace posts can carry a price. Comments, search, county filter, profiles with a "Verified NH" badge. |
| Moderation | Verification queue, report queue, remove posts, suspend and reinstate accounts. |
| Security | CSRF tokens on every form, strict Content-Security-Policy with no scripts, HTML escaping everywhere, login rate limit, uploads checked by file signature (not just extension), ID files stored outside the web root and served only to admins with `no-store`. |

## How ID data is handled

- Uploads land in `data/private/verification/` under random names. The web server never serves that folder.
- Only admin accounts can open a file, and only while its review is pending.
- Approve or reject deletes every file for that submission before the response returns. The database keeps the document type, decision, reviewer, and date. No ID numbers, no birthdates, no images.
- Rejected or malformed uploads are deleted immediately.

## Why a passport needs a second document

A U.S. passport proves identity and citizenship. It has no address on it, so on its own it cannot show someone lives in New Hampshire. The site requires a passport holder to add a dated proof of NH address.

The reverse is also true: an NH driver license or non-driver ID shows NH residency, not U.S. citizenship. The site verifies **residents**, which is what "NH only" can be checked against. If you want citizens only, that is a different and much harder document check.

## Before public launch

1. **Domain.** Confirm the spelling. `newhampshirights` reads as "New Hampshi-rights." If you meant NewHampshireRights or NewHampshirites (the demonym), change `SITE_NAME` / `SITE_DOMAIN` before you buy it.
2. **Hosting with HTTPS.** Any Node host with a persistent disk (a small VPS works). Set `NODE_ENV=production`. Back up `data/app.db`; never back up `data/private/`.
3. **Consider a verification vendor.** Manual review works for the first few hundred members. At scale, a vendor (Persona, Stripe Identity, ID.me, and others) does document authenticity and face match automatically, and you never hold the images. The verify route is the one place to swap.
4. **Lawyer review of privacy terms.** Collecting government ID is sensitive. Have an attorney check the privacy page against New Hampshire's data-breach notification law and the NH consumer privacy statute before launch (VERIFY current text and whether its size thresholds apply to you).
5. **Marketplace payments.** Listings only. No money moves through the site. Adding checkout means a payment processor and its compliance terms.
6. **Moderators.** Recruit at least two so the queue and reports do not depend on one person.
7. **Email.** Password reset and "you're approved" notices need an email provider. Not built yet.

## Not built yet

Password reset, email notifications, direct messages, image uploads in posts, editing posts, upvotes, town-level pages, automatic purge of pending uploads after N days, account self-deletion.
