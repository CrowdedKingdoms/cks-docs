---
slug: authentication
sidebar_position: 1
title: Authentication
description: "Sign a player in with a password, a magic link, or a social provider, what the SDK hands back, the two tokens it holds for you and why you never see the one that talks to the game, session persistence, sign-out, and linked identities."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Authentication

A player signs in once, at startup, from the Game Instance. Every method, email and password, a one-time link by email, a social provider, converges on one pipeline: the sign-in returns an identity session token, the SDK mints a short-lived app-scoped token from it, adopts the app's endpoints, fires a success event, and requests the realtime connection with the app token. Your code picks the method and reacts to the event; the tokens are the SDK's business.

## When you touch this

Once per project for the sign-in itself, which the [Quickstart](../quickstart.md) already did with a password. Again when you add a sign-in screen (which methods to offer, restoring a saved session), when a player signs out, and when you let a player link a second way to sign in.

## Two tokens

| Token | Plane | Who holds it | Lifetime |
|---|---|---|---|
| Identity **session** token | Management: the account, Studio, linked identities | The SDK persists it so a later launch can restore the session | Until sign-out |
| **App-scoped** token | Gameplay: the Game API and the realtime connection, confined to one app | The SDK keeps it in memory only | About 30 minutes; refreshed for you before expiry, and again on a realtime `TOKEN_EXPIRED` |

The session token is rejected for gameplay and the app token cannot manage the account, so neither can stand in for the other. You never handle either: the SDK stores, mints, refreshes, and installs them. The mint itself is described on [Portals and app-scoped tokens](/management-api/portals-and-app-tokens#minting-an-app-token); the sign-in calls underneath are on [Sign in](/management-api/authentication).

:::danger[Never log, print, persist, or display a token.]
`FCrowdyAuthResult::GameToken`, despite its name, is the identity session token, and the SDK already holds it. The SDK's own `On Login` and `On Register` events on the Crowdy SDK Subsystem carry a human-readable message and never a credential, because anything on a Blueprint-assignable event can end up on screen. Keep yours the same way: read `UserID`, ignore `GameToken`.
:::

## Choosing a method

| Method | Needs | Call |
|---|---|---|
| Email and password | Nothing but the two strings. No inbox, no browser. Permanent and first-class, not a legacy path. | `Login`, or `Register` for a new account |
| Magic link | An inbox the player can reach while the game runs | `BeginMagicLinkSignIn` |
| Social provider | The system browser, and a provider the server has enabled | `BeginSocialSignIn` |
| A saved session | A previous sign-in on this machine | `RestoreSession` |

Password is the right default for a build machine, a bot, or an agent, and for any flow that must complete without leaving the game.

## Two surfaces, one pipeline

`UCrowdySDKSubsystem` (Game Instance subsystem, category **CrowdySDK, Authentication**) is the simple surface the Quickstart uses: `Login(Email, Password)`, `Register(Email, Password)`, `CompleteLoginLink(Token)`, `BeginMagicLinkSignIn(Email)`, `BeginSocialSignIn(Provider)`, `RefreshAppToken()`, `Logout()`, and `RequestUDPAccess()`. Each forwards to the rich surface below with no per-call delegate, and the outcome arrives on the subsystem's multicast events: `OnLogin` and `OnRegister` (`FOnLogin`, `FOnRegister`: `bSuccess`, `Message`) and `OnLogout` (`FOnLogout`: `bSuccess`).

`UCrowdyAuthentication` (Game Instance subsystem, **Crowdy Authentication**, category **Crowdy SDK, Authentication**) is the rich surface: every call takes per-call delegates, `FOnAuthSuccess` with an `FCrowdyAuthResult` and `FOnAuthError` with a message, and every success also broadcasts an event carrying the result.

| Call | What it does |
|---|---|
| `Login(Email, Password, OnSuccess, OnError)` | Password sign-in. Persists the session so a later launch can restore it. |
| `Register(Email, Password, OnSuccess, OnError)` | Creates the account and signs in. An address that already has an account is refused with `EMAIL_ALREADY_REGISTERED`, not silently converted to a login. |
| `BeginMagicLinkSignIn(Email, OnSuccess, OnError)` | Opens a loopback listener on 127.0.0.1, emails the link, and completes itself when the player clicks it. `OnError` on failure or timeout. Nothing else to call. |
| `RequestLoginLink(Email, RedirectUri, OnLinkSent, OnError)`, `CompleteLoginLink(Token, OnSuccess, OnError)` | The two steps behind the one call above, for a flow you drive yourself. `FOnLoginLinkSent` carries one `bSent`, always true so an address cannot be probed. |
| `GetAvailableLoginProviders(OnResult, OnError)` | The enabled providers (`FOnLoginProvidersReceived`, a string array). Public: no session needed. Build the sign-in buttons from it. |
| `BeginSocialSignIn(Provider, OnSuccess, OnError)` | Opens the provider's consent page in the system browser, never an embedded view, and completes when the redirect lands on the loopback listener. |
| `RestoreSession(OnSuccess, OnError)` | Restores a saved session and re-mints. Returns false at once, and calls `OnError`, when nothing is saved. |
| `ClearSavedSession()`, `HasSavedSession()` | Delete the persisted credential and cancel the refresh timer; whether one exists on disk. |
| `IsSignedIn()` | Signed in right now: a sign-in or restore completed and its app token is in memory. |
| `RefreshAppToken()` | Rotate the app token by hand. It also happens automatically before expiry. |
| `GetMyIdentities(OnResult, OnError)`, `BeginLinkIdentity(Provider, OnResult, OnError)`, `UnlinkIdentity(IdentityId, OnResult, OnError)` | Linked sign-in methods; below. |

Events on `UCrowdyAuthentication`, all Blueprint-assignable: `OnLogin` (`FOnAuthLoginEvent`) and `OnRegister` (`FOnAuthRegisterEvent`) with an `FCrowdyAuthResult`; `OnLoginFailed` (`FOnAuthLoginFailed`) and `OnRegisterFailed` (`FOnAuthRegisterFailed`) with a message; `OnSessionRestored` (`FOnAuthSessionRestored`) and `OnSessionRestoreFailed` (`FOnAuthSessionRestoreFailed`); and `OnAppTokenRefreshed` (`FOnAppTokenRefreshed`), with no parameters, after a proactive or reactive rotation.

`FCrowdyAuthResult` has two fields: `UserID`, the player's `int64` id, and `GameToken`, the session token you never read.

## Signing in

The Game Instance signs the player in from `Init`, binds the outcome event before it calls, and enables play in the handler. This is the Quickstart's step, on the same `ULanternGameInstance`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="auth-login" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Instance Blueprint, **Event Init** runs the latent **Login** node with `Email` and `Password`; its `On Success` pin carries a `Result` and `On Error` a `Message`.

<Blueprint src="auth-login" title="Event Init, Login" />

The two literals on the node are placeholders for a test account; a shipped Blueprint reads them from a widget, as [Player Sign-in](../runtime/player-sign-in.md) does.

</TabItem>
</Tabs>

:::caution[Bind your delegates before you start the call.]
A response can arrive quickly enough to be missed by a handler bound after the call returns. The per-call delegates are bound as arguments, so they are always in place; for the multicast events, bind in `Init` before the first sign-in.
:::

In Blueprint, five latent nodes wrap the rich surface, each with `On Success` (a `Result`) and `On Error` (a `Message`) pins and no delegate wiring: **Login** (`UCrowdyAuth_Login`), **Register** (`UCrowdyAuth_Register`), **Magic Link Sign In** (`UCrowdyAuth_BeginMagicLinkSignIn`), **Social Sign In** (`UCrowdyAuth_BeginSocialSignIn`), and **Restore Session** (`UCrowdyAuth_RestoreSession`). Their pin delegate types are `FLoginDelegateOnSuccess`, `FLoginDelegateOnError`, `FRegisterDelegateOnSuccess`, `FRegisterDelegateOnFailure`, `FBeginMagicLinkSignInDelegateOnSuccess`, `FBeginMagicLinkSignInDelegateOnError`, `FBeginSocialSignInDelegateOnSuccess`, `FBeginSocialSignInDelegateOnError`, `FRestoreSessionDelegateOnSuccess`, and `FRestoreSessionDelegateOnError`, should you bind one from C++.

### Register

A Create Account action on your sign-in screen calls `RegisterNewAccount`; success is the account created and signed in. It binds the two handlers every sign-in path on this page shares, `HandleSignedIn` and `HandleSignInFailed`, with `BindDynamic` before the call.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="auth-register" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnCreateAccountPressed` runs **Register** with `Email` and `Password`.

<Blueprint src="auth-register" title="OnCreateAccountPressed, Register" />

</TabItem>
</Tabs>

### Magic link

One call, `RequestMagicLink`. The SDK opens the loopback listener, sends the email, and completes the sign-in when the player follows the link. There is no second step for you to call, and `OnError` fires if the player never returns.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="auth-magic" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnRequestMagicLinkPressed` with an `Email` parameter runs **Magic Link Sign In**.

<Blueprint src="auth-magic" title="OnRequestMagicLinkPressed, Magic Link Sign In" />

</TabItem>
</Tabs>

### Social

`SignInWithGoogle` opens the provider's consent page in the system browser. The provider string comes from `GetAvailableLoginProviders`; the example hard-codes `google` only to stay short.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="auth-social" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnSignInWithGooglePressed` runs **Social Sign In** with `Provider` = `google`.

<Blueprint src="auth-social" title="OnSignInWithGooglePressed, Social Sign In" />

</TabItem>
</Tabs>

:::warning[Build the provider list from Get Available Login Providers, never from a literal.]
A server can disable or rename a provider; a hard-coded button then opens a consent page that fails. Do not hard-code a provider you saw once in the list; build the buttons from the call every launch.
:::

## After sign-in

The SDK requests the realtime connection itself, on every path: password, link, social, and restore all end in the same success handler inside the SDK, which calls `RequestUDPAccess()`, and a token refresh reinstalls the new token on the live connection. Do not call `RequestUDPAccess()` from your own success handler; by the time it runs, the SDK already did. Wait for **On UDP Connection Success** on the Crowdy SDK Subsystem for the moment the connection is up; [Connection and reconnect](../runtime/connection-and-reconnect.md) covers what follows, including `TOKEN_EXPIRED` and the automatic re-mint. `RequestUDPAccess()` remains callable for a manual recovery and nothing else.

The events are also where a game enables play. `WatchAuthEvents` binds `OnLogin` and `OnSessionRestored` to the same `HandleSignedIn`, which lights every lantern in the world, and the `Result` it receives is read for nothing: the token in it belongs to the SDK.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="auth-events" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Game Instance Blueprint needs a Boolean variable `bCanPlay`. **Event Init** gets the **Crowdy Authentication** subsystem and **Bind Event to On Login**; the bound custom event `OnSignedIn` receives the `Result` and sets `bCanPlay` true.

<Blueprint src="auth-events" title="Event Init, Crowdy Authentication, Bind Event to On Login, OnSignedIn, Set bCanPlay" />

</TabItem>
</Tabs>

## What you may read about the signed-in player

`UCrowdyGameSession` (Game Instance subsystem, category **Crowdy SDK, Game Session**) is the client's own connection and sign-in state, written by the SDK's login and handshake. A game legitimately reads four things from it:

| Accessor | Returns |
|---|---|
| `GetAppID()` | The app id, `int64`. |
| `GetUserID()` | The signed-in user's id, `int64`. Also `GetLocalUserId` on the Game Model library. |
| `GetUUID()`, `GetID()` | This client's actor identity as a string and as an `FGuid`. |

Its two events, `OnOwnerUUIDUpdated` (`FOnOwnerUUIDUpdated`) and `OnHostIDUpdated` (`FOnHostIDUpdated`), announce a new client identity and a change of the elected view-plane host; the host one belongs to [Host election](../runtime/host-authority.md). Everything else on the class, the setters, the token and URL getters, the clear call, and the getter that returns the whole connection-state struct, is written by the SDK and is not for a game to read, display, or log: that struct carries both tokens as fields, so breaking it into a widget is exactly the leak the box above forbids.

## Session persistence and sign-out

`Login`, `Register`, the link, and the social flow persist the session token; `RestoreSession` on the next launch re-mints from it and fires `OnSessionRestored`, and the SDK connects as after any sign-in. Gate your login screen on `IsSignedIn()`.

:::warning[IsSignedIn is not HasSavedSession.]
`HasSavedSession` only says a credential exists on disk. It stays true across a restart, before a restore has run, and after a restore that failed. `IsSignedIn` is true only while a sign-in or restore has completed and its app token is held in memory right now.
:::

:::warning[Sign out with Logout on the Crowdy SDK Subsystem, not ClearSavedSession alone.]
`Logout()` clears the saved session, clears the connection state, scrubs both bearers from the shared API client, and closes the realtime connection, then broadcasts `OnLogout`. `ClearSavedSession()` only deletes the on-disk credential; called alone during a live session it leaves the in-memory tokens and the open connection signed in as the player who just left.
:::

## Linked identities

A signed-in player can attach more ways to sign in. `GetMyIdentities` lists them (`FOnIdentitiesReceived`, an array of `FCrowdyUserIdentity`: `IdentityId`, `UserId`, `Provider`, `Subject`, `Email`, `bEmailVerified`, `CreatedAt`, `LastLoginAt`). `BeginLinkIdentity(Provider, ...)` runs the same browser and loopback flow as the social sign-in but attaches the result to the current session instead of starting one (`FOnIdentityLinked`). `UnlinkIdentity(IdentityId, ...)` removes one (`FOnIdentityUnlinked`, `bRemoved`). All three need an active session.

:::caution[The server refuses to unlink a player's last remaining sign-in method.]
Expect the refusal in a UI that lists identities with a remove button; do not treat it as an error to retry.
:::

## Gotchas

- Nothing connects until someone signs in. Every entity, event, and Game Model read depends on it.
- `Register` on an existing address is a refusal, `EMAIL_ALREADY_REGISTERED`; offer Login instead.
- The link and social flows need the player to reach a browser or inbox while the game runs; on a machine that cannot, use a password.
- `OnAppTokenRefreshed` fires on every rotation. You rarely need it; the connection is re-armed for you.
- Studio's own sign-in is the same account and the same methods; [Signing In](../studio/sign-in.md).

## Related

- [Quickstart](../quickstart.md): the sign-in step this page extends.
- [Connection and reconnect](../runtime/connection-and-reconnect.md): the realtime connection the sign-in requests.
- [Sessions](../game-models/sessions.md): the Game Model session, the other meaning of the word.
- [Teams](../services/teams.md) and [Avatars](../services/avatars.md): services that need a signed-in player.
- [Sign in on the Management API](/management-api/authentication): the calls at the GraphQL level.
