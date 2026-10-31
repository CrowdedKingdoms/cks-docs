---
sidebar_position: 30.5
title: Age, country and who may play
---

# Age, country and who may play

No gameplay token is issued to a player Crowded Kingdoms may not admit. Every mint and every
refresh checks the player, whichever way the token is asked for (`mintAppToken`,
`refreshAppToken`, [hosted sign-in](/management-api/portals-and-app-tokens#hosted-sign-in-for-a-game-on-its-own-domain),
or an organization signing in one of its [own players](/management-api/org-managed-players)), in
this order:

1. **Country:** `TERRITORY_NOT_SUPPORTED` where Crowded Kingdoms does not offer its services.
2. **Age:** `AGE_REQUIRED` when the player's age is not known, `AGE_REQUIREMENT_NOT_MET` when
   the player is younger than the app allows where they are.
3. **Documents:** `LEGAL_ACCEPTANCE_REQUIRED` until the player has accepted the platform's
   documents and the app's own ([Legal documents](legal-documents)).

A sign-up checks the country and the age before the account exists.

:::info[What is switched on]

- **Live** (Game API v2.60.0): the checks above; the birth date and country at sign-up and in
  `recordPlayerAge`; a managed player's `ageYears` and `country`; an app's `minPlayerAge`; and
  the country list, enforced for every player, adults included.
- **At the opening**, when Crowded Kingdoms opens to players 13 and over: the youngest player
  becomes 13; a browser sign-up must give a birth date, and an organization an age and a country
  for each player it signs in; developers must be adults. Until then nobody under 18 is admitted.
- **Being built:** refusals that name no age (they carry `extensions.minimumAge` today), a stop on
  answering again at once after an age refusal, blocks of a region within a country, and an
  exemption from the country check for Crowded Kingdoms staff.

:::

## Now, and at the opening

| | Until the opening | From the opening |
|---|---|---|
| Youngest player | 18 | 13, or older where the app or the player's country asks |
| How a Crowded Kingdoms account's age is known | the age-of-majority attestation, or a birth date | the birth date; the attestation is ignored |
| A birth date at a browser sign-up | optional | required |
| A managed player's `ageYears` and `country` | optional: with no age, the player counts as 18 or older, as the organization warrants | required |
| Countries Crowded Kingdoms does not serve | refused | refused |

## Ages are kept as brackets

A player's age is one of five brackets: `unknown` (not given yet), `under_13`, `13_15`, `16_17`
and `18_plus`. Of a birth date only the year and month are kept, and the age is counted from the
last day of that month, so it is never overstated; the bracket moves on that day. A player reads
their own:

```graphql
query { me { ageBracket country } }
```

Both are private: `null` to anyone but the player. Your app's server code reads a player's bracket,
never their age, with [`players.get`](/exec/players-and-safety#age-brackets).

## Signing up

`register` takes three more fields in `registerUserInput`:

| Field | What |
|---|---|
| `birthDate` | `YYYY-MM-DD`, or `YYYY-MM` |
| `country` | where the player lives, ISO 3166-1 alpha-2, such as `US`; sent with `birthDate` |
| `parentalConfirmation` | `true` when a player under 18 confirms that a parent or guardian agreed; required under 18, ignored at 18 and over |

```graphql
mutation SignUp($input: RegisterUserInput!) {
  register(registerUserInput: $input) { token user { userId } }
}
# variables: { "input": { "email": "...", "password": "...", "acceptLegal": true,
#   "attestAgeOfMajority": true, "birthDate": "1994-04", "country": "US" } }
```

`attestAgeOfMajority` is still required on a browser sign-up until the opening, and ignored after
it. Before any account exists, the sign-up is refused:

- `TERRITORY_NOT_SUPPORTED` for a country Crowded Kingdoms does not serve: the one the player
  gave, or the one their connection comes from;
- `AGE_REQUIREMENT_NOT_MET` under 13, or under the platform's minimum (18 until the opening) or
  the country's;
- `BAD_REQUEST` for a date that is not a real date in the past, a country without a birth date or
  a birth date without one, or a player under 18 without `parentalConfirmation: true`.

From the opening, a browser sign-up without a birth date is refused `AGE_REQUIRED`. A request
with no `Origin` header (a native client, a tool) may leave the three fields out and give them
with `recordPlayerAge` before its first mint.

### An account with no age: `recordPlayerAge`

An account whose `ageBracket` is `unknown` gives its birth date, country and (under 18) the
parent's agreement once, with its session token:

```graphql
mutation {
  recordPlayerAge(input: { birthDate: "1994-04-17", country: "US" }) { ageBracket country }
}
```

A player under 18 sends `parentalConfirmation: true` as well. The answer cannot be changed by
asking again, so record what the player entered, never a test value, on an account that will
play.

- An account that already has an age is refused `CONFLICT`, an attested one included: the age is
  not changed here. A Crowded Kingdoms operator corrects a wrong one.
- A country Crowded Kingdoms does not serve is refused `TERRITORY_NOT_SUPPORTED`.
- Under 13 is refused `AGE_REQUIREMENT_NOT_MET`, and the account keeps the bracket `under_13`, so
  answering again changes nothing.
- Whether the player may play a given app (its minimum age, the country's) is decided at the
  mint, not here.

## The age screen

Any screen that asks a player's age for Crowded Kingdoms follows these rules: a sign-up form, a
launcher, an in-game prompt, or the screen of a server that signs its own players in.

- **Ask for the date of birth and the country.** A month and a year is enough. Pick neither for
  the player, and suggest no answer.
- **Show no age.** Not the youngest age allowed, and not the player's age.
- **Show the parental line only to a player whose date makes them 13 to 17**, worded with no age.
  With it the player confirms that a parent or guardian agreed to the terms for them; send it as
  `parentalConfirmation: true`.
- **A refusal names no age.** Tell the player they cannot sign up or play, and nothing that
  reveals the age that decided it. `AGE_REQUIREMENT_NOT_MET` carries `extensions.minimumAge` and
  `extensions.ageBracket` today: never show them, and do not depend on them, because they are
  being removed.
- **Do not offer an immediate retry** after an age refusal: no way back to the date to change
  it. An answer under 13 already stays on the account; a stop on answering again at once is being
  built on Crowded Kingdoms' side for the other refusals.

## Minimum ages

The youngest player an app admits is the highest of three:

- **the platform's:** 18 until the opening, then 13;
- **the app's**, `minPlayerAge`, from 13 to 18, which only ever raises the platform's;
- **the country's**, from [`territoryPolicies`](#countries).

```graphql
mutation AdultsOnly($appId: BigInt!) {
  updateApp(appId: $appId, input: { minPlayerAge: 18 }) { minPlayerAge effectiveMinPlayerAge }
}
```

`App.effectiveMinPlayerAge` is the higher of the app's and the platform's. `minPlayerAge: null`
returns the app to the platform's minimum. A raised minimum applies at each player's next mint or
refresh: a younger player is refused `AGE_REQUIREMENT_NOT_MET`. An app whose minimum is 18 admits
no minor, and needs no [safety log](/replication-api/input-logging#the-safety-log); set it before
the opening to keep a game for adults.

## Countries

```graphql
query { territoryPolicies { countryCode status minAge } }
```

`territoryPolicies` is public, so a sign-up form can say so before an account exists. It lists the
countries Crowded Kingdoms does not serve (`status: "blocked"`) and those whose minimum age is
above 13. A country it does not list is open at the platform's minimum. Read it rather than keeping
a copy: the list changes, and every server applies a change within a minute, refusing a player
already signed in there at their next refresh.

- **A Crowded Kingdoms account** is checked on the country the player gave and the country their
  connection comes from; either one blocked refuses. Hosted sign-in checks the player's browser
  when Studio issues the code, and not again when your game exchanges it.
- **A managed player** is checked on the country its organization gives.
- **For everyone**, from Game API v2.60.0, not only for players under 18.

The Player Terms, which Crowded Kingdoms publishes at the opening, say where it offers its
services (section 1.7) and the minimum age by country (section 1.8). Until then the
[API Terms](https://crowdedkingdoms.com/api-terms.html) govern, and `territoryPolicies` is what
the API enforces.

## Players your organization signs in

A managed player has no Crowded Kingdoms sign-up, so your organization gives its age and country
at every sign-in: `ageYears` (whole years) and `country` (ISO 3166-1 alpha-2) on
`mintManagedPlayerToken`, or as the `ageYears` and `country` claims of a signed assertion.

- Under 13, or under the app's or the country's minimum, the player is refused
  `AGE_REQUIREMENT_NOT_MET` before it is created or signed in; a country Crowded Kingdoms does not
  serve, `TERRITORY_NOT_SUPPORTED`.
- The bracket and the country are stored on the player. A refresh, which carries no age, is
  refused once the stored bracket is wholly below the app's minimum.
- Until the opening both are optional, and a player with no age counts as 18 or older, as your
  organization warrants under the addendum. From the opening both are required: no age is
  `AGE_REQUIRED`, no country `BAD_REQUEST`.
- A player under 18 gets the minors' defaults: [voice and video](/game-api/communication) off
  until a parent consents, then contacts only, and no direct messages; and the app must keep its
  [safety log](/replication-api/input-logging#the-safety-log) on (`SAFETY_LOG_REQUIRED` otherwise).

If your server asks players their age, [the age screen](#the-age-screen) applies to it. See
[Org-managed players](/management-api/org-managed-players#age-country-and-minors).

## Developers

From the opening, creating an organization and administering one or its apps need the developer
documents ([Legal documents](legal-documents#developer-documents)), which only adults may accept:
an account with no age is refused `AGE_REQUIRED` (`recordPlayerAge` first), and one under 18
`AGE_REQUIREMENT_NOT_MET`. A player of 13 to 17 plays, and does not build on Crowded Kingdoms.

## Refusals

| `extensions.code` | HTTP | When | What to do |
|---|---|---|---|
| `TERRITORY_NOT_SUPPORTED` | 403 | The player's country, the one they gave or their connection's (`extensions.country`), is one Crowded Kingdoms does not serve. | Tell the player Crowded Kingdoms is not available where they are. Do not retry. |
| `AGE_REQUIRED` | 403 | The player's age is not known: an account with no age once the opening has come, or a managed player signed in without `ageYears`. | Ask the age ([the age screen](#the-age-screen)), then `recordPlayerAge`, or sign the managed player in with `ageYears` and `country`. Until the opening an account with no age is refused `LEGAL_ACCEPTANCE_REQUIRED` instead, and the attestation is its remedy. |
| `AGE_REQUIREMENT_NOT_MET` | 403 | The player is younger than the app allows where they are, or under 13; or a developer under 18. | Tell the player they cannot play this game, naming no age. Do not retry. |
| `LEGAL_ACCEPTANCE_REQUIRED` | 403 | Documents are missing (`extensions.missingDocuments`). | [Legal documents](legal-documents#the-refusal). |
| `SAFETY_LOG_REQUIRED` | 403 | A player under 18, in an app whose safety log is off. | The app's admins turn it on ([the safety log](/replication-api/input-logging#the-safety-log)). Tell the player the game cannot admit them yet. |
| `CONFLICT` | 409 | `recordPlayerAge` on an account that has an age. | Read `me { ageBracket }`; do not ask again. |
| `BAD_REQUEST` | 400 | A malformed date or country, one without the other, or a player under 18 without `parentalConfirmation`. | Fix the input. |

All codes are on [Error codes](/overview/error-codes).
