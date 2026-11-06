---
slug: player-safety
sidebar_position: 3.5
title: Players under 18 and player safety
---

# Players under 18 and player safety

Crowded Kingdoms admits players from 13. It opened to players aged 13 to 17 on 2026-11-04, for
every game on the platform, with the safety baseline described here. Players accept the
[Player Terms](https://crowdedkingdoms.com/player-terms.html) and the
[Player Privacy Policy](https://crowdedkingdoms.com/player-privacy.html).

This page is the map: what is switched on, and what your game needs to admit players under 18.
Each part has its own page.

## What is switched on

Everything below is live: in the Game API (v2.60.0 to v2.61.1), replication server v0.43.0 and
ck-exec 0.20.0, and wrapped by CrowdyJS 18.25.0, CrowdyCPP 0.76.0 and CrowdyPy 0.24.0.

:::caution[Not yet in production: parental consent]
Kids Web Services, the parental consent service, is connected in production but is not live there
until its review is complete, and refuses requests until then: `requestParentalConsent` answers
`PARENTAL_CONSENT_UNAVAILABLE` with `extensions.reason` `provider_refused` (`not_configured`
until 2026-11-06), so a player under 18 cannot turn voice or video on yet. Everything else on this
page applies in production.
:::

- **Who may play.** Every sign-up, mint and refresh checks the player's country (by region, in
  the countries checked that way), age and documents, in that order. The youngest player is 13,
  or older where the app or the player's country asks. Places Crowded Kingdoms does not serve are
  refused for everyone, adults included, except Crowded Kingdoms staff. See
  [Age, country and who may play](/management-api/age-and-territory).
- **Birth date and country.** A sign-up gives them (`register`), and an account with no age gives
  them once (`recordPlayerAge`); an organization gives an age, a country and where needed a region
  for each player it signs in itself. An age refusal names no age, and stops the same device or
  player from answering again at once. An account that declares an age under 13 is deleted and
  erased.
- **Documents.** The platform's are the Player Terms and the Player Privacy Policy; an app can
  require its own on top, and Studio's hosted sign-in asks for both. Developers accept their own
  documents before creating or administering an organization, and only adults may. See
  [Legal documents](/management-api/legal-documents).
- **Voice and video settings, contacts and blocks**, enforced by the realtime servers on both the
  sending and the receiving side. A player under 18 has voice and video off both ways until a
  parent consents, then contacts only, and no direct messages. A block stops communication;
  movement and world edits still pass. See [Voice, video, contacts and blocks](/game-api/communication).
- **The safety log.** An app that admits players under 18 keeps its input log on, with voice and
  video each at the app's choice; clients read what is recorded to show the notice and the
  indicator. On such an app only moderators read other players' records, and only those a report
  covers. See [The safety log](/replication-api/input-logging#the-safety-log).
- **Safety reports and moderation**: filing a report, moderators, resolving and escalating, and
  the evidence each report preserves. A player under 18 is admitted only to an app whose
  organization has appointed a moderator, and Crowded Kingdoms receives every child-safety report
  too. See [Safety reports and moderation](/game-api/safety-reports).
- **Your server code on ck-exec** (`ckx-sdk` 0.13.0): a player's erasure and data export reach
  your hubs, hubs check blocks and file reports, and `players.get` names a player's age bracket.
  See [Players' data, blocks and reports](/exec/players-and-safety).

Crowded Kingdoms can also delete and erase an account itself, for example at a parent's request
for a child's account, and records a parent's withdrawal of consent that reaches it by email.

## What your game needs to admit players under 18

An app admits players under 18 when its minimum age is under 18: every app that has not set
`minPlayerAge` to 18. To keep a game for adults, set it
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
4. **Offer a report option, and appoint a moderator** in your organization: a member with a role
   that grants `moderate_safety` (an admin alone does not count). Without one, players under 18
   are refused `SAFETY_MODERATOR_REQUIRED`: [Safety reports and moderation](/game-api/safety-reports#moderators).
5. **Show your app's own documents**, if it has any:
   [Legal documents](/management-api/legal-documents#your-apps-documents).
6. **In your hubs**, check `players.blocked` before carrying one player's words to another, never
   pass a player's private message to a minor as your hub's own, and implement the erasure and
   export hooks: [Players' data, blocks and reports](/exec/players-and-safety).
7. **If your organization signs its own players in**, send each one's age and country, and the
   region where it is needed: [Org-managed players](/management-api/org-managed-players#age-country-and-minors).

## Where players go

The [Safety](https://crowdedkingdoms.com/safety.html) page tells players and parents how to
report a player, a child's safety, an intimate image shared without consent, a security issue or a
copyright claim. Intimate images are removed through
[its own form](https://crowdedkingdoms.com/remove-intimate-image.html), without an account.
