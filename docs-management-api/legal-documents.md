---
sidebar_position: 30.6
title: Legal documents
---

# Legal documents

A player accepts two sets of documents before they play: the platform's, which they accept once
for every game, and any your app requires of its own, such as its rules or an addendum. Until both
are stored, every mint and refresh for your app is refused `LEGAL_ACCEPTANCE_REQUIRED`, and the
refusal lists what is missing.

:::info[What is switched on]

- **Live** (Game API v2.60.0): your app's own documents (`setAppRequiredDocuments`), the public
  lists (`playerLegalDocuments`, `appRequiredDocuments`), the missing documents on the refusal,
  and acceptances recorded with the app and how they were given.
- **Since 2026-11-04**, when Crowded Kingdoms opened to players 13 and over: the platform's
  player documents are the Player Terms and the Player Privacy Policy, which replaced the five
  earlier documents and the age-of-majority attestation, and every player accepts them at their
  next mint. Developers accept their own documents before creating or administering an
  organization. The Org-Managed Players Addendum has a new version, which every organization
  accepts again.
- **In Studio:** the hosted sign-in asks for your app's documents with the platform's
  ([below](#hosted-sign-in-and-your-apps-documents)), and the app's page sets them.

:::

## The platform's documents

```graphql
query { playerLegalDocuments { documentId version title url } }
```

Public, so a sign-up form can show them before an account exists. The list is the
[Player Terms](https://crowdedkingdoms.com/player-terms.html) and the
[Player Privacy Policy](https://crowdedkingdoms.com/player-privacy.html), at the versions of
2026-11-04 (`player-terms-2026-11-04`, `player-privacy-2026-11-04`). Until then it was the Game
Terms, the API Terms, the SDK Developer Terms, the Free Tier and Billing Basis and the Overworld
Privacy Policy, with an age-of-majority attestation. Render whatever the list returns rather than a
list of your own: a new `version` of any document asks every player again at their next mint.

## Your app's documents

An app admin (`manage_apps`) sets the documents the app's players accept on top of the
platform's:

```graphql
mutation Rules($appId: BigInt!) {
  setAppRequiredDocuments(appId: $appId, documents: [
    { documentId: "rules", version: "rules-2026-11-01",
      title: "Game rules", url: "https://my-game.example.com/rules.html" }
  ]) { documentId version }
}
```

- The list replaces the app's whole list: a document left out stops being required. An empty list
  requires none.
- At most 10. `documentId` is 1 to 64 lower-case letters, digits and hyphens, unique in the app,
  and not one of the platform's ids. `version` is 1 to 128 letters, digits and `. _ : + -`; a date
  is usual. `title` is 1 to 200 characters, and `url` an `https` address.
- A new `version` asks every player of the app again at their next mint or refresh.

`appRequiredDocuments(appId)` is public and returns the app's list, with `appId` set on each.

Players your organization signs in itself accept none of these: your organization's acceptance of
the [Org-Managed Players Addendum](/management-api/org-managed-players#before-the-first-sign-in-accept-the-addendum)
stands in for them, and you give your players your own terms.

## Recording a player's acceptance

Show each document's title with a link to its `url`, and a checkbox the player ticks. Then record
the acceptance with the player's identity session token:

```graphql
query Accepted($appId: BigInt!) { playerLegalAcceptance(appId: $appId) }   # false: ask first

mutation Accept($appId: BigInt!) {
  recordPlayerConsents(acceptLegal: true, appId: $appId)
}
```

- `appId` records the app's documents together with the platform's; without it, only the
  platform's are recorded. `playerLegalAcceptance(appId)` is true once both sets are stored.
- `attestAgeOfMajority` is ignored since 2026-11-04: the age comes from the player's birth date
  ([Age, country and who may play](age-and-territory)). A client that still sends it is not
  refused.
- `method` says how the player accepted: `CLICKWRAP` (the default), on a Crowded Kingdoms page or
  an SDK sign-up form, or `IN_GAME`, on your game's own screen.
- It records the player's own agreement: call it only after they ticked the box. Repeating it is
  harmless.

`register` records the platform's documents when the player ticked them (`acceptLegal: true`); an
app's documents are recorded afterwards with `recordPlayerConsents`.

## The refusal

```json
{
  "errors": [{
    "message": "Accept the current terms (recordPlayerConsents) before playing; extensions.missingDocuments lists them.",
    "extensions": {
      "code": "LEGAL_ACCEPTANCE_REQUIRED",
      "httpStatus": 403,
      "missingDocuments": [
        { "documentId": "rules", "version": "rules-2026-11-01", "appId": "42" }
      ]
    }
  }]
}
```

`appId` is null for one of the platform's documents. Show the missing documents (their titles and
URLs come from `playerLegalDocuments` and `appRequiredDocuments`), record the acceptance, and mint
again. Retrying without that cannot succeed.

## Hosted sign-in and your app's documents

Studio's hosted sign-in (`/authorize`) asks for the platform's documents and your app's own before
it issues the code, lists the ones a refusal named, and records them with your app. A first-party
or native client, an SDK sign-up form or an in-game screen records them itself with
`recordPlayerConsents(appId)`. Set your app's documents in Studio, on the app's page under
**Settings > Players' documents**, or with `setAppRequiredDocuments`.

## Developer documents

Developers accept the [API Terms](https://crowdedkingdoms.com/api-terms.html), the
[SDK Developer Terms](https://crowdedkingdoms.com/sdk-terms.html) and the
[Free Tier and Billing Basis](https://crowdedkingdoms.com/billing-basis.html) before they create an
organization or administer one or its apps (since 2026-11-04).

```graphql
query { developerLegalDocuments { documentId version title url } developerLegalAcceptance }

mutation { recordDeveloperConsents(acceptDeveloperTerms: true) }
```

Only an adult may accept them: an account with no age is refused `AGE_REQUIRED` (it gives one with
[`recordPlayerAge`](age-and-territory#an-account-with-no-age-recordplayerage)), and one under 18
`AGE_REQUIREMENT_NOT_MET`. Until they are accepted, `createOrganization` and the organization's and
apps' administration answer `LEGAL_ACCEPTANCE_REQUIRED`.

## In the SDKs

- **CrowdyJS 18.25.0:** `client.auth.playerLegalDocuments()`, `appRequiredDocuments(appId)`,
  `recordPlayerConsents({ acceptLegal, appId, method })` and
  `playerLegalAcceptance({ appId })`; `legalAcceptanceRequiredOf(err).missingDocuments` reads the
  refusal; an app admin calls `client.apps.setRequiredDocuments(appId, documents)`; a developer
  `developerLegalDocuments()`, `recordDeveloperConsents()` and `developerLegalAcceptance()`.
- **CrowdyCPP 0.76.0:** `auth().recordPlayerConsents(PlayerConsents)` with `appId` and `method`
  (`LegalAcceptanceMethod::IN_GAME` on your own screen), `auth().playerLegalAcceptance(appId)`,
  `playerLegalDocuments()`, `appRequiredDocuments(appId)` and
  `admin().apps().setRequiredDocuments(appId, documents)`.
- **CrowdyPy 0.24.0:** `auth.record_player_consents(accept_legal=True, app_id=…, method=…)`,
  `auth.player_legal_acceptance(app_id=…)`, `auth.player_legal_documents()`,
  `auth.app_required_documents(app_id)` and `apps.set_required_documents(app_id, documents)`.
