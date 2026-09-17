---
title: Game Models overview
sidebar_position: 1
---

# Game Models overview

Game Models hold the gameplay state the server is authoritative for: hit points, stats, inventory, anything a client must not be able to forge. This section covers how a model is declared in Unreal, how a client reads it and asks for a change, how effects apply mutations on the server, and how policies decide which requests are allowed. Fast-changing view state such as movement and animation is not a Game Model; see the Runtime section for that.
