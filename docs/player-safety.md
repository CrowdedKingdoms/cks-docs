---
slug: player-safety
sidebar_position: 3.5
title: Players under 18 and player safety
---

# Players under 18 and player safety

Crowded Kingdoms is opening to players aged 13 to 17. It opens at one moment, for every game on
the platform, once the safety baseline described here is live in production. Until then every
player must be 18 or older, as the [API Terms](https://crowdedkingdoms.com/api-terms.html)
(sections 3.1 and 6.11) say today.

This page is the map: what changes, what is switched on, and what your game needs before it admits
players under 18. Each part has its own page.

## Three states

The pages in this set mark each feature with one of these:

- **Live:** in the Game API from v2.60.0, or in the release this page names.
- **At the opening:** built, and switched on when Crowded Kingdoms opens to players 13 and over.
  Until then the platform admits nobody under 18, so nothing that concerns a minor can happen yet.
- **Being built:** decided, not released yet.

### Live

- **Who may play.** Every sign-up, mint and refresh checks the player's country, age and
  documents, in that order. Countries Crowded Kingdoms does not serve are refused for everyone,
  adults included. An app can ask for an older minimum age than the platform's. See
  [Age, country and who may play](/management-api/age-and-territory).
- **Birth date and country at sign-up** (`register`, `recordPlayerAge`), and an age and a country
  for each player an organization signs in itself (`ageYears`, `country`).
- **Documents of your app's own**, which its players accept on top of the platform's. See
  [Legal documents](/management-api/legal-documents).
- **Voice and video settings, contacts and blocks** in the Game API, and the request for a
  parent's consent. See [Voice, video, contacts and blocks](/game-api/communication).
- **The safety log.** An app that admits players under 18 keeps its input log on; voice and video
  are recorded separately, each at the app's choice; clients read what is recorded to show the
  notice and the indicator. See [The safety log](/replication-api/input-logging#the-safety-log).
- **Safety reports and moderation**: filing a report, moderators, resolving and escalating, and
  the evidence each report preserves. See [Safety reports and moderation](/game-api/safety-reports).
- **Your server code on ck-exec** (ck-exec 0.20.0, `ckx-sdk` 0.13.0): a player's erasure and data
  export reach your hubs, hubs check blocks and file reports, and `players.get` names a player's
  age bracket. See [Players' data, blocks and reports](/exec/players-and-safety).

**Not released yet:** the replication servers that enforce the settings, contacts and blocks, and
check every receiving player's permission keys (the release after v0.42.0). Until it, the API
stores what players choose and the realtime servers apply none of it: they check the sender's
permission keys, as before.

### At the opening

- The youngest player is 13, or older where the app or the player's country asks.
- A browser sign-up gives a birth date and a country; the age-of-majority attestation is no longer
  asked. An organization gives an age and a country for every player it signs in.
- The platform's player documents become the Player Terms and the Player Privacy Policy. They
  are published at the opening, with a new version of the
  [Org-Managed Players Addendum](https://crowdedkingdoms.com/managed-players-addendum.html) that
  every organization accepts again.
- Developers accept their own documents before creating or administering an organization, and
  only adults may.
- Players under 18 get the minors' defaults: voice and video off both ways until a parent
  consents, then contacts only; no direct messages.

### Being built

- No refusal names an age, and a player cannot answer again at once after an age refusal.
- An app that admits players under 18 needs at least one moderator, or its minors are refused
  sign-in.
- Every child-safety report also reaches Crowded Kingdoms' own moderators, across all games.
- On an app that admits players under 18, only moderators read other players' safety-log
  records, and only those a report covers; every read of a player's own records is audited too.
- Blocks of a region within a country, and an exemption from the country check for Crowded
  Kingdoms staff.
- Studio's hosted sign-in showing an app's own documents.

## Before your game admits players under 18

An app admits players under 18 when its minimum age is under 18: once Crowded Kingdoms opens,
that is every app that has not set `minPlayerAge` to 18. To keep a game for adults, set it now
([Minimum ages](/management-api/age-and-territory#minimum-ages)). Such an app needs no safety
log, no moderator and no parental consent, and no minor reaches it. Everything else still
applies to it: the country check, the age and country every sign-up and every managed player's
sign-in carries, the documents, contacts and blocks, and the erasure hooks and block checks in
its hubs.

1. **Ask the age the neutral way**, if your client or your server asks a player for it:
   [the age screen](/management-api/age-and-territory#the-age-screen).
2. **Keep the safety log on**, with a funded wallet, and if it records voice or video, show the
   notice and the indicator: [the safety log](/replication-api/input-logging#the-safety-log).
3. **Give players the controls**: voice and video settings, contacts, blocking, and for a player
   under 18 a way to ask a parent: [what your game shows](/game-api/communication#what-your-game-shows).
4. **Offer a report option, and name moderators** in your organization:
   [Safety reports and moderation](/game-api/safety-reports).
5. **Show your app's own documents**, if it has any:
   [Legal documents](/management-api/legal-documents#your-apps-documents).
6. **In your hubs**, check `players.blocked` before carrying one player's words to another, and
   implement the erasure and export hooks: [Players' data, blocks and reports](/exec/players-and-safety).
7. **If your organization signs its own players in**, send each one's age and country:
   [Org-managed players](/management-api/org-managed-players#age-country-and-minors).

## Where players go

The [Safety](https://crowdedkingdoms.com/safety.html) page tells players and parents how to
report a player, a child's safety, an intimate image shared without consent, a security issue or a
copyright claim. Intimate images are removed through
[its own form](https://crowdedkingdoms.com/remove-intimate-image.html), without an account.
