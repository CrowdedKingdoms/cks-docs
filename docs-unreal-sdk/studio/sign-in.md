---
slug: sign-in
sidebar_position: 2
title: Signing In
description: The account and organization-token sign-in options in Crowdy Studio, what each grants, and where the session is kept.
---

# Signing In

Crowdy Studio opens on its Sign In page. You sign in once; Studio remembers the session across editor launches until you sign out.

## The sign-in page, top to bottom

![The Sign In page: backend selector, email and password, sign-in link, organization token; the provider buttons appear above the form when the backend offers them](/img/unreal-sdk/studio-sign-in.png)

1. **Backend.** A selector above the form. Leave it at its default unless Crowded Kingdoms told you otherwise.
2. **Continue with ...** buttons, one per social provider your backend offers: Google, GitHub, Discord, Apple, or Microsoft. The section is hidden when none is offered. A provider sign-in opens your system browser, never an embedded web view, and returns to Studio when it completes.
3. **Email** and **Password**, with **Log In**.
4. **Email me a sign-in link.** Uses the email you typed above and sends a one-time link. Click the link in your mail client and this Studio window signs you in, no password needed.
5. **Use an organization token instead.** A toggle at the bottom that reveals a token field and **Sign In with Token**.

Options 2, 3, and 4 are all account sign-ins and end in the same place: a session that can author everything.

## What each credential grants

**An account sign-in** (email and password, a sign-in link, or a provider) gives you full authoring: Config Sync, teams, channels, grids, and the Web Console.

**An organization token** gives management-only access. It can browse apps, run Config Sync, and reach the Web Console, but it cannot author game-plane data.

:::caution[An organization token cannot author teams, channels, or grids.]
Those pages need an account sign-in. If you signed in with a token and an authoring page looks read-only, sign out and sign in with your account. The token is the right choice for a build machine that syncs config and must not hold authoring credentials.
:::

After a successful sign-in Studio lands on the Setup Wizard, so the guided path is the first thing you see.

## Agreeing to the terms

When Studio asks the server for its access to your app and the account has not yet agreed to the current terms and age confirmation, Studio opens a small window titled **Crowdy Studio: terms and age** over the editor. It is the same prompt a player sees in your game: the documents as links, two check boxes, **Accept** and **Decline**. **Accept** carries on where Studio left off. **Decline**, or closing the window, stops there and Studio reports `Studio needs the terms and the age confirmation accepted for this account.` You see the prompt again only when a document gets a new version. How the same prompt works in a game, and how to draw your own, is on [Authentication](../services/authentication.md#let-the-player-agree-to-the-terms).

## Where the session is kept

Studio stores the signed-in session in a per-user file under your project's `Saved/CrowdyStudio/` folder, never under `Config/` and never in anything you would commit. The stored record remembers whether it was an account or a token sign-in, so a remembered account session comes back with its full authoring rights.

:::info[On Windows the stored session is encrypted for your user account with the operating system's data protection (DPAPI). On other platforms it is written in the clear, and Studio warns about it.]
Treat the `Saved` folder on a shared macOS or Linux machine as you would a credential file.
:::

## Your account

The **Account** page, under **Home** in the sidebar, is for the account Studio is signed in with: yours, not a player's. It needs an account sign-in; an organization token has no account of its own, and the page says so. **Refresh** reads your name and email again, and **Web console** opens your account on the web, where sign-in methods and connected apps are managed.

![The Account page: the name card with email, gamertag and disambiguation, then the Password tab](/img/unreal-sdk/studio-account.png)

- **The name card** shows your gamertag, its disambiguation and your user id (with a copy button), and your email. **Edit name** turns it into two fields; **Save** changes both, and a pair another account has is refused.
- **Password**: pick **I have a password** to change it, with your current password and a new one; your other devices are signed out while Studio stays signed in. Pick **I don't have one yet** to add one to an account made by magic link or social sign-in; it works at once, and a security email goes to your address.
- **Sessions**: **Sign out everywhere** ends every session of your account, on every device and in every game, Studio's included, and returns Studio to the Sign In page.

What a player can change from inside your game is on [Authentication](../services/authentication.md#account-settings) and [Player Names](../services/player-names.md).

## Signing out

Press **Sign Out** in the Studio header. It ends the session on the server, clears the stored session, clears the Web Console's browser session too, and returns you to the Sign In page. A token sign-in is only forgotten: the token stays valid, since others may use it.

## Gotchas

- The provider buttons come from the backend. A provider you expect but do not see is not enabled for that backend.
- A sign-in link arrives by email. Check the address you typed if nothing comes.
- Token sign-in is silent about what it cannot do until you open an authoring page. The page subtitle tells you it needs an account sign-in.
- The backend selector is remembered with the project. Changing it changes which servers Config Sync writes into the project.

## Related

- [Projects and Apps](./projects-and-apps.md): pick or create the app after signing in.
- [Config Sync](./config-sync.md): write the app's ids and endpoints into the project.
- [Crowdy Studio overview](./overview.md): the sidebar and what needs a sign-in.
