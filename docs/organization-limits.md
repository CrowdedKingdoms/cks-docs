---
slug: organization-limits
sidebar_position: 23
title: What your organization can change, and what to ask Crowded Kingdoms for
sidebar_label: What your organization can change
---

# What your organization can change, and what to ask Crowded Kingdoms for

Your organization sets most of what it uses for itself, in Studio or through the Management
API. For the settings on this page, part of the decision is Crowded Kingdoms': it switches a
feature on for one organization at a time, or it holds a limit that funding lifts or that it
raises when a game needs more. Each section gives the default, where to read your
organization's value, what you change yourself, and what to send when you ask for a change.

On this page an organization is *funded* when its wallet has a spendable balance or
auto-billing is on.

## Each setting has a default, and this table says who changes it

| Setting | Default | Who changes it |
|---|---|---|
| [Org-managed players](#crowded-kingdoms-switches-org-managed-players-on-and-sets-their-limits) | Off | Crowded Kingdoms switches them on. An admin of your organization accepts the addendum. |
| Managed players your organization holds | 100,000 | Crowded Kingdoms |
| Managed-player sign-ins a minute | 600 | Crowded Kingdoms |
| Length of a managed player's sign-in | 24 hours, and 7 days at most | Your server, for each sign-in, from 60 seconds up to your organization's maximum. Crowded Kingdoms sets the default and the maximum. |
| [Fleet sessions](#crowded-kingdoms-switches-fleet-sessions-on-and-sets-how-many-you-hold) | Off | Crowded Kingdoms |
| Fleet sessions your organization holds at once | 512 | Crowded Kingdoms |
| Players one fleet session carries | 256 | Crowded Kingdoms |
| [Compute](#funding-raises-your-compute-limit-and-crowded-kingdoms-can-set-a-higher-one) before funding | 16 instances that reserve 1,024 MB, in each datacenter, shared by all your apps | You, by funding your organization |
| Compute once funded | 16,384 instances that reserve 65,536 MB, in each datacenter, for each app | Crowded Kingdoms |
| [Free data out and data in](#you-reach-two-free-data-tiers-yourself-and-crowded-kingdoms-decides-two-more) a month | 15 GB each (the Base tier) | You reach Domain (100 GB) and Measured (500 GB). Crowded Kingdoms approves Profile (200 GB) and makes written agreements. |
| [Apps](#funding-lifts-the-limit-of-10-apps) that are not archived | 10 before funding, and no limit once funded | You, by funding your organization |
| [App trust](#crowded-kingdoms-decides-which-apps-skip-the-consent-screen) | Not trusted | Crowded Kingdoms |
| [Environment](#a-dedicated-environment-needs-an-enterprise-agreement) | Shared | Crowded Kingdoms, under an Enterprise Agreement |
| [A player's data](#you-delete-your-own-players-and-crowded-kingdoms-handles-the-requests-you-cannot) | Kept until you delete the player | You delete and disable your managed players. Crowded Kingdoms handles exports, accounts with their own sign-in, legal holds, and a parent's withdrawal of consent. |
| [Organization status](#crowded-kingdoms-closes-and-reinstates-an-organization) | Active | Crowded Kingdoms closes and reinstates an organization |
| [Crowd size](#talk-to-crowded-kingdoms-before-a-crowd-larger-than-the-one-it-measured) | Measured with 6,000 players on 200 fleet sessions | Write to Crowded Kingdoms before a larger crowd |

## To ask for a change, write to hello@crowdedkingdoms.com

Send one email for each request, with:

- your organization's name or its id (`orgId`);
- the app the request is for, by name or `appId`, when it concerns one app;
- the number you want, and what that number is sized for;
- the date you need it by.

Each section below says what else that request needs. Crowded Kingdoms promises no response
time for these requests, so ask as early as you can.

## Crowded Kingdoms switches org-managed players on and sets their limits

- **What it is.** Players your organization signs in itself, with an org token from your
  server or an assertion your sign-in service signs.
  [Org-managed players](/management-api/org-managed-players) is the guide.
- **Default.** Off. Once they are on, your organization holds at most 100,000 players and
  makes at most 600 sign-ins a minute, counted over both sign-in options. A sign-in lasts 24
  hours when your server names no length, and 7 days at most.
- **Read your value.** `orgManagedPlayerSettings(orgId)`, with the session of a member who
  holds `manage_players`: `enabled`, `maxPlayers`, `playerCount`, `mintsPerMinute`,
  `defaultSessionTtlSeconds`, `maxSessionTtlSeconds`, `termsVersion`, and `termsAccepted`.
  Studio shows them on your organization's **Players** tab.
- **What you change.** An admin of your organization accepts the
  [Org-Managed Players Addendum](https://crowdedkingdoms.com/managed-players-addendum.html):
  in Studio on the **Players** tab, or with `acceptManagedPlayerTerms(orgId, version)`.
  Crowded Kingdoms staff cannot accept it for you
  ([the addendum](/management-api/org-managed-players#before-the-first-sign-in-accept-the-addendum)).
  Your server sets the length of each sign-in with `sessionTtlSeconds`, from 60 seconds up
  to your maximum. Deleting players you no longer need (`deleteManagedPlayer`) makes room
  under the cap.
- **What Crowded Kingdoms changes.** It switches org-managed players on or off. It sets the
  player cap, the sign-ins a minute, and the default and the maximum length of a sign-in.
- **What to send.** For the player cap, the number of player accounts you expect to hold.
  For the sign-in rate, the most sign-ins you expect in one minute, and whether you create
  your players ahead of a launch with `provisionManagedPlayers`.
- **At the limit.** A sign-in or a provisioning call that would create a player past the cap
  answers `MANAGED_PLAYER_LIMIT` (403); players who already exist still sign in. A sign-in
  past the rate answers `RATE_LIMITED` (429). While org-managed players are off, sign-ins
  answer `FORBIDDEN`, and until the addendum is accepted they answer
  `ORG_LEGAL_ACCEPTANCE_REQUIRED`. See [Error codes](/overview/error-codes#graphql-errors).

## Crowded Kingdoms switches fleet sessions on and sets how many you hold

- **What it is.** One realtime session that each of your game servers holds, on which the
  server carries its players.
  [Run your own game servers with a fleet session](/management-api/fleet-sessions) is the
  guide. Fleet sessions need org-managed players switched on and the addendum accepted.
- **Default.** Off. Once they are on, your organization holds at most 512 sessions at once,
  counted over all its apps, and one session carries at most 256 players at once.
- **Read your value.** `orgManagedPlayerSettings(orgId)`: `fleetSessionsEnabled`,
  `maxFleetSessions`, and `maxFleetPlayers`. `maxPlayers` in the answer of
  `openFleetSession` or `refreshFleetSession` is the number that applies to that session.
  Studio does not show these three.
- **What you change.** How many sessions you hold: open one for each game server, and close
  it with `closeFleetSession` when the server stops. A session ends by itself 24 hours after
  it was opened or last refreshed.
- **What Crowded Kingdoms changes.** It switches fleet sessions on or off; switching them
  off ends the sessions you hold. It sets `maxFleetSessions` and `maxFleetPlayers`. An open
  session takes a new player number at its next refresh.
- **What to send.** How many game servers you run, and how many players one server holds.
- **At the limit.** `openFleetSession` answers `FLEET_SESSION_LIMIT` (403) while your
  organization holds as many sessions as it may. A carry past the player number is refused
  with status 4 in `FLEET_CARRY_RESULT`
  ([the limits](/management-api/fleet-sessions#each-session-has-a-known-limit-and-you-grow-by-adding-servers)).
  While fleet sessions are off, the calls answer `FORBIDDEN`. See
  [Error codes](/overview/error-codes#graphql-errors).

## Funding raises your compute limit, and Crowded Kingdoms can set a higher one

- **What it is.** How many instances of your [ck-exec](/exec/intro) code run at once in one
  datacenter, and how much memory they reserve. Hubs, spokes, and your players' mods all
  count. An instance reserves its type's memory limit times its copies. The API counts this
  memory in MB of 2^20 bytes, as `memory_mb` in a manifest does.
- **Default.** Before your organization is funded: 16 instances that reserve 1,024 MB, in
  each datacenter, shared by all of its apps. Once it is funded: 16,384 instances that
  reserve 65,536 MB, in each datacenter, for each app.
- **Read your value.** `orgComputeCeiling(orgId)`, for a member who holds
  `view_compute_diagnostics`: `maxInstances`, `maxReservedMb`, `funded`, the defaults
  (`defaultMaxInstances`, `defaultMaxReservedMb`), and `operatorSet`, which is true when
  Crowded Kingdoms set the limit for your organization. `execAppStatus(appId)` reports one
  app's limit and what it holds now in its datacenter (`maxInstances`, `maxReservedMb`,
  `instances`, `reservedMb`) and, before funding, what your apps share (`orgMaxInstances`,
  `orgMaxReservedMb`, `orgInstances`, `orgReservedMb`).
- **What you change.** Fund the wallet or turn on auto-billing to move from the shared limit
  to the funded one. To fit more instances inside a limit, give small hubs a smaller
  `memory_mb` and keep a spoke's `concurrency` to what it needs
  ([usage and budgets](/exec/operations#usage-and-budgets)).
- **What Crowded Kingdoms changes.** It sets a limit for your organization in place of the
  funded default, for each app in each datacenter. Your apps take the change within about a minute. The limit applies only while
  your organization is funded. Reserved memory is billed by the GB-hour as before, so a
  higher limit raises what an app can cost.
- **What to send.** The instances and the memory you need, with the sum behind them: for
  example, one hub of 16 MB for each of 8,000 players online is 8,000 instances and
  128,000 MB.
- **At the limit.** Nothing new of the app starts until some instances stop, and running
  instances are left alone. A call to a hub key that is not running is answered
  `Unavailable`, with a message that names the limit
  ([call limits](/exec/operations#call-limits)). These answers are ck-exec statuses:
  see [Code on ck-exec](/overview/error-codes#code-on-ck-exec).

## You reach two free data tiers yourself, and Crowded Kingdoms decides two more

- **What it is.** Your organization's free data out and free data in for a month, each, set
  by its tier. The rest of the free allowance (compute, stored data, compute-module writes,
  and reserved memory) is the same at every tier:
  see [Free tier](/management-api/shared-environment#free-tier). The API calls a tier a
  level (`FreeTierLevel`).
- **Default.** Base: 15 GB of data out and 15 GB of data in a month.
- **Read your value.** `orgFreeTier(orgId)` (`view_billing`): `thisMonth` and `nextMonth`,
  each a `level` and its `gigabytes`, with `earnedLevel`, `conditions`, `profileStatus`,
  `ownDomain`, `measuredQualifyingDays`, and `agreements`. Studio shows your tier on the
  **Plan and Usage** tab. `freeTierLevels` lists the tiers and needs no sign-in.
- **What you change.** Two tiers are yours to reach
  ([Free data tiers](/management-api/shared-environment#free-data-tiers)):
  - **Domain, 100 GB.** Name your organization's own domain with
    `setOrgOwnDomain(orgId, domain)` (`manage_billing`), and have a member confirm an email
    address at that domain or one of its subdomains.
  - **Measured, 500 GB.** One of your apps has at least 10 different player accounts, your
    own members excluded, on at least 3 of the last 7 UTC days.

  For the Profile tier, you complete the project profile in Studio or with
  `setOrgProjectProfile`.
- **What Crowded Kingdoms changes.** Two decisions are Crowded Kingdoms':
  - **Profile, 200 GB.** Crowded Kingdoms reviews a complete profile and approves or
    declines it. `profileStatus` reads `WAITING_FOR_REVIEW`, then `APPROVED` or `DECLINED`.
  - **A written agreement** gives a larger allowance for whole months, starting with the
    next month at the earliest. `agreements` shows the amount and the months it covers.

  A tier applies from the start of the next month, whether it goes up or down. A check at
  23:30 UTC each day sets next month's tier.
- **What to send.** Nothing for the Profile tier: a complete profile is in review as soon as
  you save it. For a written agreement, the GB of data out and data in you want for a month,
  the months, and what the game sends (players online and the data you expect them to use).
- **At the limit.** Usage past a free allowance is billed from the wallet. When your
  organization cannot be charged, the app is denied with the reason `insufficient_funds`
  and realtime connections answer `APP_PAUSED`
  ([what "access denied" means](/management-api/shared-environment#what-access-denied-means)).
  `setOrgOwnDomain` answers `FREE_EMAIL_DOMAIN` for a free email provider's domain. See
  [Error codes](/overview/error-codes#graphql-errors).

## Funding lifts the limit of 10 apps

- **What it is.** How many apps your organization has that are not archived.
- **Default.** 10 before your organization is funded. A funded organization has no limit.
- **Read your value.** `orgAppLimit(orgId)` (`manage_apps`): `apps`, `funded`, and `max`,
  which is null when there is no limit. Studio shows the count when you create an app.
- **What you change.** Fund the wallet, turn on auto-billing, or archive an app you no
  longer need. No app is ever removed to meet the limit.
- **What Crowded Kingdoms changes.** Nothing. This limit has no setting for one
  organization.
- **What to send.** Nothing.
- **At the limit.** `createApp`, and `updateApp` restoring an archived app, answer
  `APP_LIMIT_REACHED` (409), with `extensions.limit` set to `apps` and `extensions.max` to
  10. See [Error codes](/overview/error-codes#graphql-errors).

## Crowded Kingdoms decides which apps skip the consent screen

- **What it is.** In hosted sign-in, a player is asked to allow an app before the app
  receives a token for them. A *trusted* app skips that screen
  ([consent](/management-api/portals-and-app-tokens#consent-and-the-oauth-client-registry)).
- **Default.** Not trusted.
- **Read your value.** `isTrusted` on the app, or `portalConsent(appId)`, which answers
  `trusted` and `consentRequired`.
- **What you change.** The rest of the app's sign-in settings, with `setAppClientSettings`
  (`manage_apps`): its redirect URIs, client type, and launch URL.
- **What Crowded Kingdoms changes.** `isTrusted`. No setting of yours changes it.
- **What to send.** The app, its launch URL and redirect URIs, and the reason its players
  should skip the consent screen. Crowded Kingdoms decides each request.
- **At the limit.** For an app that is not trusted, `createPortalAuthorizationCode` answers
  `FORBIDDEN` with a message that starts `CONSENT_REQUIRED` until the player has allowed the
  app. See [Consent](/overview/error-codes#consent).

## A dedicated environment needs an Enterprise Agreement

- **What it is.** A private environment that runs only your organization's apps, in place of
  the shared environment every app runs on.
- **Default.** Shared. A new app is created there and is active at once
  ([Shared environment and billing](/management-api/shared-environment)).
- **Read your value.** `deploymentTarget` on the app reads `shared`.
- **What you change.** Nothing here: there is no environment to provision yourself and no
  API for one. To have capacity held for an app on the shared environment, buy
  [reserved capacity](/management-api/shared-environment#reserved-capacity) from your
  account.
- **What Crowded Kingdoms changes.** It provides a dedicated environment, with any custom
  service level, under a written Enterprise Agreement
  ([API Terms](https://crowdedkingdoms.com/api-terms.html), sections 2.8 and 14.1).
- **What to send.** What you are building, the players you expect online at once, the
  datacenter you want, and the date.
- **At the limit.** No error code applies.

## You delete your own players, and Crowded Kingdoms handles the requests you cannot

- **What it is.** What the platform holds about a player in your apps, and who can delete it
  or hand it over. [Players under 18 and player safety](/overview/player-safety) is the map
  of the safety pages.
- **Default.** A managed player's data stays until your organization deletes the player.
  In an app with input logging on, recorded inputs are kept for 7 days.
- **Read your value.** `managedPlayer(orgId, externalId)` reads one of your players. A
  member with `manage_apps` reads an app's recorded inputs with `inputLogSessions` and
  `inputLogMessages` ([Input logging](/replication-api/input-logging)).
- **What you change.** For the players your organization signs in, your organization
  answers their requests about their data
  ([Org-Managed Players Addendum](https://crowdedkingdoms.com/managed-players-addendum.html),
  section 5.3):
  - `deleteManagedPlayer(orgId, externalId)` deletes a player, and their content in your
    apps is then erased
    ([what it erases](/management-api/org-managed-players#sessions-refresh-and-signing-out)).
    `deleteManagedPlayers` deletes up to 100 players in one call and answers an outcome for
    each: `DELETED`, `NOT_FOUND`, or `LEGAL_HOLD` (Application API v2.90.0).
  - `updateManagedPlayer` with `disabled: true` ends a player's access and keeps their data.
  - Your hubs delete and export what they hold about a player when the platform asks:
    implement [`on_player_erased` and `on_player_export`](/exec/players-and-safety#erasure).
    A player's erasure is complete only when every hub of the app that holds stored state has
    been asked, so read
    [before you drop a node type](/exec/players-and-safety#an-erasure-is-complete-only-when-every-hub-with-stored-state-has-been-asked).

  A player with their own Crowded Kingdoms account deletes it from their account page in
  Studio (`deleteMyAccount`).
- **What Crowded Kingdoms changes.** Four things:
  - **A data export.** Crowded Kingdoms answers a request for what the platform holds
    about one player in one app. The export includes the player's recorded inputs while
    they are kept, and what your hubs [export](/exec/players-and-safety#export).
  - **An account with its own Crowded Kingdoms sign-in.** Your organization cannot delete
    it. The player, or the parent of a player under 18, writes to
    hello@crowdedkingdoms.com
    ([Player Privacy Policy](https://crowdedkingdoms.com/player-privacy.html), section 10).
  - **A legal hold.** Crowded Kingdoms sets and releases holds. A hold that a
    [safety report](/application-api/safety-reports#when-a-reported-player-deletes-their-account)
    set is released when the report is resolved.
  - **A parent's withdrawal of consent** to voice or video for a player under 18. When it
    reaches Crowded Kingdoms by email, Crowded Kingdoms records it, and the medium turns
    off for the player within a second
    ([parental consent](/application-api/communication#parental-consent-for-voice-and-video)).
- **What to send.** The app, and the player: the `externalId` of a managed player, or the
  user id of any other. For a withdrawal of consent, say whether it covers voice, video, or
  both.
- **At the limit.** `deleteManagedPlayer` answers `LEGAL_HOLD` (409) while a hold covers the
  player or your organization. Disable the player instead. `deleteManagedPlayers` keeps a held
  player and reports the outcome `LEGAL_HOLD` for it. See
  [Error codes](/overview/error-codes#graphql-errors).

## Crowded Kingdoms closes and reinstates an organization

- **What it is.** Whether your organization is in use. A closed organization is kept, with
  its billing records, and can be reinstated.
- **Default.** Active.
- **Read your value.** `organization(id)` answers `status`: `active`, `frozen` while Crowded
  Kingdoms has frozen the organization, or `retired` once it is closed.
- **What you change.** You can wind an organization down yourself: archive its apps
  (`archiveApp`, `manage_apps`), revoke its org tokens (`revokeOrgToken`), delete its
  managed players, and turn auto-billing off. No API lets an organization close itself.
- **What Crowded Kingdoms changes.** It closes an organization. The organization's apps are
  archived, its tokens stop working, its members lose their permissions in it, and it
  leaves their list of organizations. It signs no managed player in. Its fleet sessions and
  its game servers' hub connections end at once (Application API v2.90.0; within five minutes
  before). Crowded Kingdoms also reinstates a closed organization. The
  organization is then active again and its apps stay archived: restore the ones you want
  with `updateApp`.
- **What to send.** Your organization's name, id, and slug, and the reason. Read section 12
  of the [API Terms](https://crowdedkingdoms.com/api-terms.html) first: it says what happens
  to a wallet balance and to your data when an account ends.
- **At the limit.** No error code applies.

## Talk to Crowded Kingdoms before a crowd larger than the one it measured

- **What it is.** The largest crowd that moves between an organization's game servers for
  which Crowded Kingdoms has a published measurement. It is a measurement, and no setting
  holds your organization to it.
- **Measured.** Two runs on November 27, 2026, on Crowded Kingdoms' internal dev environment,
  with realtime servers v0.51.0 on three servers:
  - 100 fleet sessions carried 3,000 players for 30 minutes. The players made 135,092
    crossings between game servers in those 30 minutes, 75 a second, and 140,616 in the whole
    run. None was lost.
  - 200 fleet sessions carried 6,000 players for 15 minutes. The players made 153,079
    crossings in the run, at 150 a second. None was lost, and a carry was answered in 36 ms
    at the median and in 57 ms at the 99th percentile.

  Those are two runs on one environment. No larger crowd, and no faster rate of crossing, has
  a published measurement
  ([the measurement](/management-api/fleet-sessions#one-session-for-each-game-server-carries-that-servers-players)).
- **Read your value.** Your limits allow more than was measured: at the defaults, 512
  sessions of 256 players is 131,072 players at once.
- **What you change.** How a crowd arrives. Create your players before a launch with
  `provisionManagedPlayers`, 500 a call, and start new players over a few minutes
  ([administering your players](/management-api/org-managed-players#administering-your-players)).
  More players means more game servers, each with its own session.
- **What Crowded Kingdoms changes.** Nothing by a setting. Before you bring a crowd larger
  than 6,000 players, or one that crosses between servers more than 150 times a second, write
  to Crowded Kingdoms.
- **What to send.** The players you expect online at once, how many game servers carry them,
  how often a player moves between servers, how many new players sign in during the first
  minutes, and the date.
- **At the limit.** A sign-in that the platform cannot start in time answers
  `PLATFORM_BUSY` (503) with `extensions.retryAfterMs`, from 200 ms to 10 seconds for a
  sign-in (Application API v2.90.0): wait that long, then send it again.
  See [Error codes](/overview/error-codes#platform_busy-we-could-not-start-the-work).

## Report a security problem by email

- **What to send.** Email hello@crowdedkingdoms.com with a subject that starts `SECURITY:`.
  Describe the problem, name the affected component and its version (a release tag, an npm
  version, or the URL you found it at), and give the steps to reproduce it.
- **What you do.** Do not open a public issue for a vulnerability. Ask before you test
  against production: `ck.crowdedkingdoms.com`, `studio.crowdedkingdoms.com`, and
  `*.prod.crowdedkingdoms.com`.

The [Safety](https://crowdedkingdoms.com/safety.html) page has the same address, with where
players and parents report everything else.

## Send rates, call limits, and countries are on their own pages

- [Rate limits and query cost](/overview/rate-limits) has the send rate of a session, the
  call limits of ck-exec, and the fixed limits of a fleet session.
- [Error codes](/overview/error-codes) lists every code named on this page.
- [Countries](/management-api/age-and-territory#countries) says where Crowded Kingdoms
  offers its services. `territoryPolicies` lists the countries and regions.
