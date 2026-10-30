---
slug: authentication
sidebar_position: 1
title: Authentication
description: "Sign a player in with a password, a magic link, or a social provider, what the SDK hands back, the two tokens it holds for you and why you never see the one that talks to the game, session persistence, sign-out, account settings (password, email, delete, sign out everywhere), linked identities, the player's own access and claiming free access, and what to show when the app is paused, the player's access ends or the account is blocked."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Authentication

A player signs in once, at startup: from the Game Instance in C++, from the Game Mode in Blueprint. Every method, email and password, a one-time link by email, a social provider, converges on one pipeline: the sign-in returns an identity session token, the SDK mints a short-lived app-scoped token from it, adopts the app's endpoints, fires a success event, and requests the realtime connection with the app token. Your code picks the method and reacts to the event; the tokens are the SDK's business.

## When you touch this

Once per project for the sign-in itself, which the [Quickstart](../quickstart.md) already did with a password. Again when you add a sign-in screen (which methods to offer, restoring a saved session, a forgotten password, free access), when a player signs out, when you build an account settings screen, and when you let a player link a second way to sign in.

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
| `RecordPlayerConsents(bAcceptLegal, bAttestAgeOfMajority, OnRecorded, OnError)`, `DeclineLegalAcceptance()` | Store the player's agreement and let a held sign-in finish, or fail it. Only for a game that draws its own prompt; [Let the player agree to the terms](#let-the-player-agree-to-the-terms). |
| `IsLegalAcceptancePending()`, `GetLegalDocuments()` | Whether a sign-in is waiting for the player's agreement; the documents to link, as `FCrowdyLegalDocument` rows (`Title`, `Url`). |
| `RequestPasswordReset`, `ResendConfirmationEmail`, `ChangePassword`, `AddPassword`, `DeleteAccount`, `SignOutEverywhere` | The player's account settings; [Account settings](#account-settings). |
| `GetMyAccess(OnResult, OnError)`, `ClaimFreeAccess(OnSuccess, OnError)` | The player's own access to this app, and claiming the app's free access; [When the player has no access yet](#when-the-player-has-no-access-yet). |

Events on `UCrowdyAuthentication`, all Blueprint-assignable: `OnLogin` (`FOnAuthLoginEvent`) and `OnRegister` (`FOnAuthRegisterEvent`) with an `FCrowdyAuthResult`; `OnLoginFailed` (`FOnAuthLoginFailed`) and `OnRegisterFailed` (`FOnAuthRegisterFailed`) with a message; `OnSessionRestored` (`FOnAuthSessionRestored`) and `OnSessionRestoreFailed` (`FOnAuthSessionRestoreFailed`); `OnAppTokenRefreshed` (`FOnAppTokenRefreshed`), with no parameters, after a proactive or reactive rotation; and `OnLegalAcceptanceRequired` (`FOnLegalAcceptanceRequired`) and `OnLegalAcceptanceEnded` (`FOnLegalAcceptanceEnded`), with no parameters, when a sign-in starts and stops waiting for the player to agree to the terms.

`FCrowdyAuthResult` has two fields: `UserID`, the player's `int64` id, and `GameToken`, the session token you never read.

## Signing in

The game signs the player in at startup, binds the outcome event before it calls, and enables play in the handler. In C++ the Game Instance does it from `Init`; in Blueprint the Game Mode does it from **Event BeginPlay**. This is the Quickstart's step, on the same `ULanternGameInstance` and Game Mode.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The C++ is the `ULanternGameInstance` block on [Player Sign-in](../runtime/player-sign-in.md): bind `OnLogin` and `OnUDPConnectionSuccess` on the Crowdy SDK Subsystem in `Init`, then call `Login` with the account read from `Config/DefaultGame.ini`. The rich surface in the table above is reached the same way, through `GetSubsystem<UCrowdyAuthentication>()`, with the per-call delegates passed as arguments.

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Mode Blueprint, **Event BeginPlay** gets the **Crowdy Authentication** subsystem and branches on its **Is Signed In**; only when that is false does it run the latent **Login** node with `Email` and `Password`. Both its `On Success` and `On Error` pins carry a `Result` and a `Message`: `Result` is filled on success, `Message` says why on error. The other sign-in nodes, and **Record Player Consents** (`Message` only), work the same way.

<Blueprint src="auth-login" title="Event BeginPlay, Crowdy Authentication, Is Signed In, Branch, Login" />

The two literals on the node are placeholders for a test account; a shipped Blueprint reads them from a widget, as [Player Sign-in](../runtime/player-sign-in.md) does.

</TabItem>
</Tabs>

:::caution[In Blueprint, start from the Game Mode's Event BeginPlay, not the Game Instance's Event Init.]
A Blueprint Game Instance's **Event Init** runs before the SDK's subsystems exist. There the subsystem getters return nothing, **Login** and **Restore Session** fail at once, and **Bind Event** binds nothing. The Game Mode's **Event BeginPlay** runs after the Game Instance has finished starting. It runs again in every map, so a graph that signs in checks **Is Signed In** first and skips the call when the player already is. Is Signed In stays false until a sign-in finishes, so open another map only after **On Login**, or the next map signs in a second time. A graph has one Event BeginPlay: if your Game Mode already has one, run the new chain from it through a **Sequence** node, the binds on the first pin and the sign-in on a later one. A C++ Game Instance can use `Init` as the C++ examples do, because the subsystems exist once `Super::Init()` has returned. If your clients join an Unreal listen or dedicated server, a client has no Game Mode: use the local Player Controller's BeginPlay there instead.
:::

:::caution[Bind your delegates before you start the call.]
A response can arrive quickly enough to be missed by a handler bound after the call returns. The per-call delegates are bound as arguments, so they are always in place; for the multicast events, bind before the first sign-in: in `Init` after `Super::Init()` in C++, from the Game Mode's Event BeginPlay in Blueprint.
:::

In Blueprint, five latent sign-in nodes wrap the rich surface (a sixth, **Record Player Consents** (`UCrowdyAuth_RecordPlayerConsents`), is for a game that draws its own terms screen; its pins are `FRecordPlayerConsentsDelegateOnSuccess` and `FRecordPlayerConsentsDelegateOnError`), each with `On Success` (a `Result`) and `On Error` (a `Message`) pins and no delegate wiring: **Login** (`UCrowdyAuth_Login`), **Register** (`UCrowdyAuth_Register`), **Magic Link Sign In** (`UCrowdyAuth_BeginMagicLinkSignIn`), **Social Sign In** (`UCrowdyAuth_BeginSocialSignIn`), and **Restore Session** (`UCrowdyAuth_RestoreSession`). Their pin delegate types are `FLoginDelegateOnSuccess`, `FLoginDelegateOnError`, `FRegisterDelegateOnSuccess`, `FRegisterDelegateOnFailure`, `FBeginMagicLinkSignInDelegateOnSuccess`, `FBeginMagicLinkSignInDelegateOnError`, `FBeginSocialSignInDelegateOnSuccess`, `FBeginSocialSignInDelegateOnError`, `FRestoreSessionDelegateOnSuccess`, and `FRestoreSessionDelegateOnError`, should you bind one from C++.

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

## Let the player agree to the terms

The server hands out no gameplay token until the signed-in player has agreed to the current terms and confirmed they are at least 18, or the age of majority where they live if that is higher. A new version of a document asks again. What the server requires and how it is stored is on [Terms and age of majority](/management-api/portals-and-app-tokens#terms-and-age-of-majority); this section is what the SDK does about it and what you can change.

### What the player sees by default

You write nothing. When a sign-in, sign-up, restore, or token refresh is refused for this reason, the SDK holds it instead of failing it, and opens a prompt over the game viewport in the Crowded Kingdoms colors: the five documents as links, one checkbox to agree to them, one to confirm the age, and **Accept** and **Decline**. **Accept** is enabled once both boxes are ticked.

- **Accept** records the player's agreement, closes the prompt, and finishes the sign-in they started: your `OnLogin`, `OnRegister`, `OnSessionRestored`, or `OnAppTokenRefreshed` handler runs exactly as it would have without the prompt.
- **Decline** closes the prompt and fails that sign-in with `Sign-in needs the terms and the age confirmation.` through its usual failure path (`OnError` and the failed event), so your sign-in screen shows it like any other refusal.
- If the agreement cannot be recorded (the network dropped, say), the prompt shows the error and stays up, and the sign-in stays held.

The prompt also appears in the middle of a session when a document gets a new version: the next token refresh is refused, held, and the prompt opens over the game. Declining it leaves the current app token to run out.

Only one sign-in waits at a time. While one waits, the SDK does not rotate the app token, and a newer sign-in that is refused takes the place of the older one, which fails first.

To see the prompt without an account that still needs it, run `crowdy.auth.consent.preview` in the console of a development build. It opens the same prompt over the game; **Accept** and **Decline** only close it, and nothing is recorded. The command is not in Shipping builds.

### Draw your own prompt

A game with its own sign-in screens can turn the built-in prompt off and show the same choice in its own style. Clear **Show Consent Prompt** (`bShowConsentPrompt`, on by default) under **Project Settings, Plugins, Crowdy SDK, Authentication**, then handle the hold yourself:

1. Bind `OnLegalAcceptanceRequired` on the Crowdy Authentication subsystem before the first sign-in. It fires once per hold, with no parameters.
2. Show the documents from `GetLegalDocuments()`, an array of `FCrowdyLegalDocument` (`Title`, `Url`), as links, in that order, with two checkboxes: one to agree to the documents, one for the age.
3. When the player ticks both and presses accept, call `RecordPlayerConsents(true, true, ...)`. If they decline, call `DeclineLegalAcceptance()`.
4. Close your UI on `OnLegalAcceptanceEnded`. It fires whenever nothing is held any more, however the hold ended, so a recorded consent, a decline, and a sign-out all end up in one place.

:::danger[Record consent only from the player's own accept.]
`RecordPlayerConsents` stores the player's agreement on their account. Never call it for them, from a timer, or with a box that was pre-ticked: the call does nothing unless both arguments are true, and both must come from boxes the player ticked.
:::

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`ULanternGameInstance` shows its own terms screen. `ShowTermsScreen` and `HideTermsScreen` are your widget code; `OnTermsAccepted` is called by the accept button with the two boxes' states. The success path is empty on purpose: when the consent is stored the held sign-in resumes and reaches the handlers you already bound.

```cpp
// LanternGameInstance.h
UFUNCTION() void ShowTermsScreen();
UFUNCTION() void HideTermsScreen();
UFUNCTION() void HandleConsentError(FString Message);
void OnTermsAccepted(bool bAgreedToDocuments, bool bConfirmedAge);
void OnTermsDeclined();

// LanternGameInstance.cpp
void ULanternGameInstance::Init()
{
	Super::Init();

	UCrowdyAuthentication* Auth = GetSubsystem<UCrowdyAuthentication>();
	Auth->OnLegalAcceptanceRequired.AddDynamic(this, &ULanternGameInstance::ShowTermsScreen);
	Auth->OnLegalAcceptanceEnded.AddDynamic(this, &ULanternGameInstance::HideTermsScreen);
}

void ULanternGameInstance::OnTermsAccepted(bool bAgreedToDocuments, bool bConfirmedAge)
{
	if (!bAgreedToDocuments || !bConfirmedAge)
	{
		return;
	}

	FOnAuthError OnError;
	OnError.BindDynamic(this, &ULanternGameInstance::HandleConsentError);
	GetSubsystem<UCrowdyAuthentication>()->RecordPlayerConsents(true, true, FOnLegalConsentsRecorded(), OnError);
}

void ULanternGameInstance::OnTermsDeclined()
{
	GetSubsystem<UCrowdyAuthentication>()->DeclineLegalAcceptance();
}
```

`ShowTermsScreen` builds its list from `UCrowdyAuthentication::GetLegalDocuments()`, which is static and needs no subsystem. `HandleConsentError` shows the message and leaves the screen up so the player can try again: when recording fails, the sign-in stays held.

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Mode Blueprint, **Event BeginPlay** gets the **Crowdy Authentication** subsystem and binds **Bind Event to On Legal Acceptance Required** to a custom event that creates your terms widget and adds it to the viewport, and **Bind Event to On Legal Acceptance Ended** to one that removes it. The widget fills its document list from **Get Legal Documents**, a pure node returning an array of **Crowdy Legal Document** (`Title`, `Url`).

The widget's accept button runs a branch on its two check boxes, and only when both are true calls the latent **Record Player Consents** node with **Accept Legal** and **Attest Age Of Majority** set true. Its **On Error** pin carries a `Message` to show; **On Success** needs nothing, because the held sign-in resumes and reaches the nodes you already wired. The decline button calls **Decline Legal Acceptance** on the Crowdy Authentication subsystem. **Is Legal Acceptance Pending** reads whether a sign-in is waiting right now, for a widget that opens late.

</TabItem>
</Tabs>

### Sign-in for a server or a build with no window

The prompt needs a viewport. A dedicated server, a headless client, a commandlet, or any process with no game viewport, no Slate, or no way to render cannot show it and cannot record consent for a player. A sign-in there that needs consent, with nothing else bound to `OnLegalAcceptanceRequired`, now fails at once with `Sign-in needs the terms and the age confirmation.` through its usual failure path and a Warning in the log, instead of waiting for a prompt that can never appear. Sign such an account in once from a game or Crowdy Studio with a window; after it has agreed, a headless process signs in as before. A headless process that answers consent itself, by binding `OnLegalAcceptanceRequired` and recording consent as in [Draw your own prompt](#draw-your-own-prompt), keeps working.

For a headless smoke test, development builds have console commands that sign a test account in from a JSON file, report the sign-in state and sign out: `crowdy.auth.signin.file`, `crowdy.auth.status` and `crowdy.auth.signout`. See [Sign in from the console](../guides/testing-locally.md#sign-in-from-the-console). They are not in Test or Shipping builds.

Crowdy Studio shows the same prompt in a window of its own when the account you sign in with has not agreed yet; see [Signing In](../studio/sign-in.md#agreeing-to-the-terms).

## After sign-in

The SDK requests the realtime connection itself, on every path: password, link, social, and restore all end in the same success handler inside the SDK, which calls `RequestUDPAccess()`, and a token refresh reinstalls the new token on the live connection. Do not call `RequestUDPAccess()` from your own success handler; by the time it runs, the SDK already did. Wait for **On UDP Connection Success** on the Crowdy SDK Subsystem for the moment the connection is up; [Connection and reconnect](../runtime/connection-and-reconnect.md) covers what follows, including `TOKEN_EXPIRED` and the automatic re-mint. `RequestUDPAccess()` remains callable for a manual recovery and nothing else.

The events are also where a game enables play. `WatchAuthEvents` binds `OnLogin` and `OnSessionRestored` to the same `HandleSignedIn`, which lights every lantern in the world, and the `Result` it receives is read for nothing: the token in it belongs to the SDK.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="auth-events" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Game Mode Blueprint needs a Boolean variable `bCanPlay`. **Event BeginPlay** gets the **Crowdy Authentication** subsystem and **Bind Event to On Login**; the bound custom event `OnSignedIn` receives the `Result` and sets `bCanPlay` true. Each map has its own Game Mode, so in a map the player travels to after signing in, set `bCanPlay` from **Is Signed In** at BeginPlay instead of waiting for an event that already fired.

<Blueprint src="auth-events" title="Event BeginPlay, Crowdy Authentication, Bind Event to On Login, OnSignedIn, Set bCanPlay" />

</TabItem>
</Tabs>

## What you may read about the signed-in player

`UCrowdyGameSession` (Game Instance subsystem, category **Crowdy SDK, Game Session**) is the client's own connection and sign-in state, written by the SDK's login and handshake. A game legitimately reads four things from it:

| Accessor | Returns |
|---|---|
| `GetAppID()` | The app id, `int64`. |
| `GetUserID()` | The signed-in user's id, `int64`. |
| `GetUUID()`, `GetID()` | This client's actor identity as a string and as an `FGuid`. |

Its events `OnOwnerUUIDUpdated` (`FOnOwnerUUIDUpdated`) and `OnHostIDUpdated` (`FOnHostIDUpdated`) announce a new client identity and a change of the elected view-plane host; the host one belongs to [Host election](../runtime/host-authority.md). The other two, for a paused app and for ended access, are the next two sections. Everything else on the class, the setters, the token and URL getters, the clear call, and the getter that returns the whole connection-state struct, is written by the SDK and is not for a game to read, display, or log: that struct carries both tokens as fields, so breaking it into a widget is exactly the leak the box above forbids.

### When the app is paused

The same class tells your game when the app has been switched off or paused, so you can show a message instead of letting players retry. It is read-only, like the rest, and safe to show:

| Blueprint (C++) | Returns |
|---|---|
| **Is App Paused** (`IsAppPaused()`), pure | True while the app is paused. |
| **Get App Paused Reason** (`GetAppPausedReason()`), pure | Why it is paused, such as "the app is paused" when the realtime server refused the player's updates. |
| **On App Paused Changed** (`OnAppPausedChanged`, a `FOnCrowdyAppPausedChanged`) | An event with `Paused` and `Reason`, every time the state or its reason changes. |

It turns on when signing in or refreshing the app token reports the app paused (its owner switched it off, or it ran out of funds), or when the realtime server refuses the player's updates because the app is paused. It turns off when a later token answer says the app is active or carries no runtime gate at all (which counts as not paused, so a pause an earlier answer raised clears; a pause the realtime server raised lasts until its own expiry), when the realtime server relays to the player again (or the player's updates go through for 15 seconds), and on sign-out. Bind the event, show a "the world is paused" message while it is on, and take it down when it turns off. [Server Objects](../exec/troubleshooting.md#waiting-is-not-failing) behave the same way: a call comes back **Paused**, and a read waits.

### When the player's access ends

A player's access to the game can end while they play: the platform suspends it, revokes it, lets it expire or signs the player out, or the account is blocked. The Game Session tells your game, so you can say why and send the player back to sign in. It is read-only and safe to show:

| Blueprint (C++) | Returns |
|---|---|
| **On Access Ended** (`OnAccessEnded`, a `FOnCrowdyAccessEnded`) | An event with `Reason` and `BlockedUntil`. |
| **Has Access Ended** (`HasAccessEnded()`), pure | True from the moment access ends until the player signs in again. |
| **Get Access Ended Reason** (`GetAccessEndedReason()`), pure | Why, in the platform's words. Empty while access has not ended. |
| **Get Access Blocked Until** (`GetAccessBlockedUntil()`), pure | When a timed block or a suspension ends, as an ISO-8601 time such as `2026-11-01T09:00:00Z`. Empty otherwise, or while it lasts until someone lifts it. |

[Server Objects](../exec/troubleshooting.md#when-access-ends) stop at once. Every one fails with `Your access ended: ` followed by the reason, a call in flight or made later finishes as the outcome **Access Ended**, which is not retryable, and nothing reconnects until the player signs in again. What your game does:

- Bind **On Access Ended** before the first sign-in: in the Game Instance's `Init` in C++, from the Game Mode's Event BeginPlay in Blueprint.
- Show the reason, and **Blocked Until** when it is not empty, then return the player to the sign-in screen.
- When the end time of a timed block or a suspension is learned after access already ended, the event fires once more with **Blocked Until** filled in. Update the text you showed; do not add a second message.
- A successful sign-in clears the ended state. A **Crowdy Server Object** component, and a typed node set to **Find By Asset**, then get their Server Object again by themselves. Code that calls `Acquire` itself acquires again.

The game binds the event next to the sign-in events, in the Game Instance's `Init` in C++ and from the Game Mode's Event BeginPlay in Blueprint, and shows the two strings. A shipped game puts them on its sign-in screen.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="access-ended" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Mode Blueprint, **Event BeginPlay** gets the **Crowdy Game Session** subsystem and runs **Bind Event to On Access Ended**; the bound custom event `OnAccessEnded` receives `Reason` and `BlockedUntil`, and prints each.

<Blueprint src="access-ended-bind" title="Event BeginPlay, Crowdy Game Session, Bind Event to On Access Ended, OnAccessEnded, Print String" />

</TabItem>
</Tabs>

### When the app refuses the player's access

The app itself can refuse a player: it [revoked their access, suspended it until a time](/management-api/game-setup#revoking-suspending-and-banning), or never granted it (or the grant expired). The SDK learns it when it signs the player in or renews the app token, which the server answers with `ACCESS_REVOKED`, `ACCESS_SUSPENDED` or `ACCESS_NOT_GRANTED`. A cut also revokes the player's current token, so the realtime connection is refused when it reconnects; the SDK then asks for a new token at once, which is how a game that holds no Server Object hears of the refusal within seconds, and how a player whose access is restored reconnects without signing in again. The sign-in fails through its usual failure path with the server's message, **On Access Ended** fires with that message, and **Blocked Until** carries the end of a suspension. The SDK then stops renewing the token, since the server would refuse it again. A suspension lifts by itself at that time, and a revoke or a missing grant when the app restores or grants the access; the next sign-in after that goes through and clears the ended state.

### When the account is blocked

A blocked account cannot sign in. **Login**, **Register**, **Magic Link Sign In**, **Social Sign In** and **Restore Session** all fail through their usual failure path (`OnError`, and the failed event) with the server's own message, so your sign-in screen shows why like any other refusal. The block also ends access: **On Access Ended** fires, with **Blocked Until** set when the block has an end. Until the player signs in again, the SDK does not rotate the app token in the background, since the server would refuse it. Once the block is lifted or has run out, the next sign-in goes through and clears the ended state.

### When the player has no access yet

A sign-in refused with `ACCESS_NOT_GRANTED` keeps the player's session, so your sign-in screen can say what to do next rather than only showing the refusal. Two calls on `UCrowdyAuthentication` work in that state, because they use the session rather than a gameplay token:

| Blueprint (C++) | What it does |
|---|---|
| **Get My Access** (`GetMyAccess(OnResult, OnError)`) | Reads the player's own access to this app as an `FCrowdyAppAccess`: `State` (**None**, **Active**, **Suspended**, **Expired** or **Revoked**), `TierID`, `ExpiresAt` and `SuspendedUntil` (zero when not set), and `bFreeGrant`, true when the access came from the app's free tier. |
| **Claim Free Access** (`ClaimFreeAccess(OnSuccess, OnError)`) | Claims the app's free access for the player, then finishes the sign-in that was refused. **On Success** carries the same `Result` as **Login**, and `On Login` fires. |

`GetMyAccess` answers on `FOnAppAccessRead`, and `State` is an `ECrowdyAccessState`. The nodes are `UCrowdyAccount_GetMyAccess`, whose pins are `FAccessAsyncResult` (`Access`, `Error`, `Message`), and `UCrowdyAccount_ClaimFreeAccess`, whose pins are the sign-in nodes' `FAuthAsyncResult` (`Result`, `Message`).

**Claim Free Access** never lifts a revoke: a player whose access was revoked stays refused, and **On Error** says so. It also fails when the app has no free tier. A player who already has access gets a success without a new token. Buying a paid tier happens on the web portal, not in the game.

A Get Free Access button on the sign-in screen, shown when the refusal says the player has no access, is all it takes. `GetFreeAccess` reuses the two handlers every sign-in path on this page binds.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="acct-claim" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnGetFreeAccessPressed` runs **Claim Free Access**; its **On Error** prints the `Message`. **On Success** needs nothing here, because the **On Login** handlers you already bound run.

<Blueprint src="acct-claim" title="OnGetFreeAccessPressed, Claim Free Access" />

</TabItem>
</Tabs>

## Session persistence and sign-out

`Login`, `Register`, the link, and the social flow persist the session token; `RestoreSession` on the next launch re-mints from it and fires `OnSessionRestored`, and the SDK connects as after any sign-in. Gate your login screen on `IsSignedIn()`.

### Restore a saved session

A returning player should type nothing. The game calls `RestoreSession(OnSuccess, OnError)` first, before it shows a sign-in screen or calls `Login`. The call returns `bool`: true means a saved session was found and the restore is under way, and the outcome arrives on the delegates; false means nothing is saved on this machine, `OnError` has already run with `No saved session found`, and `OnSessionRestoreFailed` has already fired, so the error path is the sign-in screen. On success the SDK re-mints the app token from the saved session token, calls `OnSuccess`, and fires `OnSessionRestored`; then, exactly as after a `Login`, it requests the realtime connection with the fresh app token and raises its own `OnLogin` on the Crowdy SDK Subsystem, so the handlers you bound for a first sign-in, `OnLogin` and `OnUDPConnectionSuccess`, run unchanged. A restore that fails after finding a saved session (the token was revoked, the network is down) reaches `OnError` the same way. The Crowdy SDK Subsystem's `OnLogin` also fires, with `bSuccess` false and the message, for every failed restore: the `No saved session found` of a first launch and a restore the player's decline of the terms ended included.

The saved session lives in the game's `Saved` folder (for a Shipping package, under the Windows user's local app data). Each PIE window inside the editor process keeps its own; every other client using that folder, a PIE client the editor starts as a separate process included, shares one, unless you start it with `-crowdysession=<name>` (letters, digits, `-` and `_`, up to 32 characters), which gives it a session of its own. With no switch the game uses the default session. See [Two packaged or standalone clients](../guides/testing-locally.md#two-packaged-or-standalone-clients); before v2.21.1 there is no switch.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`RestoreOrSignIn` is what `Init` calls in place of the bare `Login` from the Quickstart. `OnSuccess` is the same `HandleSignedIn` every path on this page binds; `HandleRestoreFailed` falls through to `Login` with the configured account, and a game with a sign-in screen shows it there instead. The return value is ignored on purpose: both outcomes arrive on the delegates.

<CppSnippet id="auth-restore" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Mode Blueprint, **Event BeginPlay** gets the **Crowdy Authentication** subsystem and branches on **Is Signed In**; only when that is false does it run the latent **Restore Session** node, which takes nothing but the world context. Its **On Error** pin is the only place that asks for credentials: the graph runs **Login** with the configured account there, as the Quickstart does, and a game with a sign-in screen creates the widget from [Player Sign-in](../runtime/player-sign-in.md) and adds it to the viewport on that pin instead; a machine with nothing saved reaches it at once. **On Success** carries the `Result`, read for nothing.

<Blueprint src="auth-restore" title="Event BeginPlay, Crowdy Authentication, Is Signed In, Branch, Restore Session, Login" />

</TabItem>
</Tabs>

:::warning[IsSignedIn is not HasSavedSession.]
`HasSavedSession` only says a credential exists on disk. It stays true across a restart, before a restore has run, and after a restore that failed. `IsSignedIn` is true only while a sign-in or restore has completed and its app token is held in memory right now.
:::

:::warning[Sign out with Logout on the Crowdy SDK Subsystem, not ClearSavedSession alone.]
`Logout()` first tells the server to end the session, which also ends every gameplay token made from it, without waiting for the answer, so sign-out works offline too. It then clears the saved session, clears the connection state, scrubs both bearers from the shared API client, and closes the realtime connection, and broadcasts `OnLogout`. A sign-in, token mint or refresh still in flight when you log out is cancelled: the caller's own `OnError` gets `Signed out before sign-in finished.`, nothing else fires (not `OnLoginFailed`), and the player is not signed back in when the answer lands. A magic-link or social sign-in still waiting for the browser is stopped too. `ClearSavedSession()` only deletes the on-disk credential; called alone during a live session it leaves the in-memory tokens and the open connection signed in as the player who just left.
:::

### Cancel a sign-in

A sign-in screen's Cancel or Back button, and a game that travels or quits while a sign-in is still running, call `CancelSignIn()` on `UCrowdyAuthentication` (or on the Crowdy SDK Subsystem). It stops whatever sign-in has not finished: a restore, a password sign-in or registration, an email link or social sign-in waiting for the browser, or one held for the terms. Unlike `Logout`, a cancelled restore keeps the saved session, so it restores again on the next launch. `IsSignInPending()` is true from the moment a sign-in starts until it succeeds, fails or is cancelled; show the Cancel button on it. Once the player is signed in, both are false and `CancelSignIn` does nothing: signing out is `Logout`.

What the caller sees:

- Only the pending call's own `OnError` answers, with `Sign-in cancelled.`: no `OnLoginFailed`, `OnSessionRestoreFailed` or `OnRegisterFailed` fires, as after `Logout`. A browser wait and a sign-in held for the terms answer at once, and the terms prompt closes; a call already on its way to the server answers when its answer lands, and the player is not signed in by it. A game that started the sign-in from the Crowdy SDK Subsystem, which passes no `OnError`, reads `IsSignInPending` instead.
- A new sign-in (password, registration, email link or social) saves its session as soon as the server accepts it, before the app token is minted, and that replaces any session saved before. Cancelling it after that point ends the new session on the server and deletes it from disk, so the next launch restores nobody rather than an account the player backed out of.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`CancelPendingSignIn` is what the Cancel button calls. The answer arrives on the `HandleSignInFailed` the sign-in itself bound.

<CppSnippet id="auth-cancel" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Cancel button's event gets the **Crowdy Authentication** subsystem, branches on **Is Sign in Pending**, and calls **Cancel Sign In** on the true pin.

<Blueprint src="auth-cancel" title="OnCancelSignInPressed, Crowdy Authentication, Is Sign in Pending, Branch, Cancel Sign In" />

</TabItem>
</Tabs>

## Account settings

Six calls on `UCrowdyAuthentication`, each a latent node under **Crowdy SDK, Account**, cover what a settings screen and a sign-in screen need. Every one answers on `FOnAccountDone` (no parameters) or `FOnAccountError`, which carries an `FCrowdyAccountError` (`Code`, `Message`) and the `Message` again; on the nodes, **On Success** and **On Error** share the `Error` and `Message` pins, filled only on error.

| Blueprint (C++) | Needs | What it does |
|---|---|---|
| **Request Password Reset** (`RequestPasswordReset(Email, ...)`) | Nothing: works signed out | Emails a link to set a new password. It succeeds whether or not the address has an account, so an address cannot be probed. |
| **Resend Confirmation Email** (`ResendConfirmationEmail(Email, ...)`) | Nothing | Sends the address confirmation again, answering the same way. |
| **Change Password** (`ChangePassword(CurrentPassword, NewPassword, ...)`) | A sign-in | Changes the password and signs the player out on their other devices; this one stays signed in. |
| **Add Password** (`AddPassword(NewPassword, ...)`) | A sign-in, and an account with no password | Adds a password to an account made by magic link or social sign-in, which then signs in with it too. A security email goes to the account's address. |
| **Sign Out Everywhere** (`SignOutEverywhere(...)`) | A sign-in | Ends every session of the account on every device and in every game, then signs out here as `Logout` does. |
| **Delete Account** (`DeleteAccount(...)`) | A sign-in | Deletes the player's account: their personal data is removed and every session ends. The SDK then signs out here. It cannot be undone, so ask the player to confirm in your own dialog first. |

The reset link and the confirmation link finish in the browser; there is nothing more to call from the game.

Should you bind a node from C++: they are `UCrowdyAccount_RequestPasswordReset`, `UCrowdyAccount_ResendConfirmationEmail`, `UCrowdyAccount_ChangePassword`, `UCrowdyAccount_AddPassword`, `UCrowdyAccount_SignOutEverywhere` and `UCrowdyAccount_DeleteAccount`, whose pins are `FAccountAsyncResult` (`Error`, `Message`).

`FCrowdyAccountError::Code` (`ECrowdyAccountErrorCode`) names the refusals worth handling on their own:

| Code | Means | What to show |
|---|---|---|
| **Wrong Password** | The current password was wrong | Ask again |
| **No Password** | Change Password on an account that has none | Offer **Add Password** |
| **Password Already Set** | Add Password on an account that has one | Offer **Change Password** |
| **Not Signed In** | The call needs a sign-in and there is none, or the session ended | The sign-in screen |
| **Rate Limited** | Too many tries in a short time | Ask the player to wait |
| **Network Error**, **Server Error**, **Unknown** | Anything else | The `Message` |

The same error type, with **Name Taken** and **Not Found**, comes back from the player names calls on [Player Names](./player-names.md).

### Forgot password

A Forgot Password link on the sign-in screen sends the reset email to the address the player typed.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="acct-forgot" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnForgotPasswordPressed` with an `Email` parameter runs **Request Password Reset**; **On Success** prints a message that holds whether or not the address has an account.

<Blueprint src="acct-forgot" title="OnForgotPasswordPressed, Request Password Reset" />

</TabItem>
</Tabs>

### Change or add a password

A settings screen calls **Change Password** with the current and the new password. An account made by magic link or social sign-in has no password to change, and is refused with **No Password**; show **Add Password** for it instead.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="acct-password" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnChangePasswordPressed` runs **Change Password**. **On Error** breaks the `Error`, compares its `Code` with **No Password**, and only on a match prints the hint to add one.

<Blueprint src="acct-password" title="OnChangePasswordPressed, Change Password, No Password" />

</TabItem>
</Tabs>

### Delete the account

Stores that list a game with accounts expect the player to be able to delete their account from inside it. **Delete Account** runs only from the confirm button of your own "are you sure" dialog; the SDK draws none.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="acct-delete" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnDeleteAccountConfirmed` runs **Delete Account**; **On Success** prints that the account is gone and **On Error** prints the `Message`. The SDK has signed out by the time **On Success** runs.

<Blueprint src="acct-delete" title="OnDeleteAccountConfirmed, Delete Account" />

</TabItem>
</Tabs>

## Linked identities

A signed-in player can attach more ways to sign in. `GetMyIdentities` lists them (`FOnIdentitiesReceived`, an array of `FCrowdyUserIdentity`: `IdentityId`, `UserId`, `Provider`, `Subject`, `Email`, `bEmailVerified`, `CreatedAt`, `LastLoginAt`). `BeginLinkIdentity(Provider, ...)` runs the same browser and loopback flow as the social sign-in but attaches the result to the current session instead of starting one (`FOnIdentityLinked`). `UnlinkIdentity(IdentityId, ...)` removes one (`FOnIdentityUnlinked`, `bRemoved`). All three need an active session. If the player signs out while `BeginLinkIdentity` is waiting for the server's first answer, the answer is dropped when it arrives and the call reports `Signed out before sign-in finished.`; no identity is linked.

:::caution[The server refuses to unlink a player's last remaining sign-in method.]
Expect the refusal in a UI that lists identities with a remove button; do not treat it as an error to retry.
:::

## Gotchas

- Nothing connects until someone signs in. Every entity and event depends on it.
- A sign-in can wait for the player. While `IsLegalAcceptancePending()` is true none of that sign-in's handlers has fired yet, so do not retry it or time it out; [Let the player agree to the terms](#let-the-player-agree-to-the-terms).
- `Register` on an existing address is a refusal, `EMAIL_ALREADY_REGISTERED`; offer Login instead.
- The link and social flows need the player to reach a browser or inbox while the game runs; on a machine that cannot, use a password.
- `OnAppTokenRefreshed` fires on every rotation. You rarely need it; the connection is re-armed for you.
- **Delete Account** and **Sign Out Everywhere** end this session too: the SDK signs out, and the player signs in again to play.
- Studio's own sign-in is the same account and the same methods; [Signing In](../studio/sign-in.md).

## Related

- [Quickstart](../quickstart.md): the sign-in step this page extends.
- [Connection and reconnect](../runtime/connection-and-reconnect.md): the realtime connection the sign-in requests.
- [Sessions and presence](../concepts/sessions-and-presence.md): the other meanings of the word session.
- [Teams](../services/teams.md) and [Avatars](../services/avatars.md): services that need a signed-in player.
- [Player Names](./player-names.md): nametags, rosters, and letting the player choose a name.
- [Sign in on the Management API](/management-api/authentication): the calls at the GraphQL level.
