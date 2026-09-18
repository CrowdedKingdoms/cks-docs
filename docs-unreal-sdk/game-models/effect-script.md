---
slug: effect-script
sidebar_position: 4
title: EffectScript
description: "The language a Crowdy Effect's body is written in: what a script becomes on the server, statements and expressions, the property bases, parameters, require, return and fn:, signals, timers and automations, the server builtins, what is atomic, the idioms, every diagnostic, and a checklist."
---

# EffectScript

EffectScript is the small text language a Crowdy Effect's body is written in: a few `require` lines, assignments to the container's attributes, at most one `return`. The SDK parses and lowers it in the editor into the function definition the schema sync sends, and the server runs that function transactionally. This is the reference; [Authoring effects](./authoring-effects.md) is the walkthrough that uses it.

## What a script becomes

One effect asset compiles into exactly one server function. The compiler tokenizes and parses the body into a tree, then lowers it: every attribute name is resolved against the target class, each compound operator becomes an expression that reads the attribute, each write is wrapped in the attribute's clamp, a `source.` read injects a `source_id` parameter, `require` lines become the invoke policy, and, when nothing was authored, a default policy is inferred. The result is the payload the sync uploads, and the server evaluates the function inside one transaction: every `require` first, then the assignments in order, then the `return` against final state. A failed `require` rolls the whole invocation back, timers included.

Four things follow. The server owns the state and the client never writes it. Expressions read and never write; only the statement list writes. There are no loops and no local variables; `if(cond, then, else)` is an expression, not a statement. And the script is authored once, in the asset, never sent from gameplay code.

The lowering contract, on the Lantern's `Fuel` (key `fuel`, `ClampMin` 0, `ClampMax` 100):

| You write | Compiled mutation |
|---|---|
| `self.Fuel = 5` | `max(0, min(100, 5))` |
| `self.fuel += $Amount` | `max(0, min(100, self.fuel + ($Amount)))` |
| `self.fuel -= source.str + $power` | `max(0, min(100, self.fuel - (ref($source_id).str + $power)))` |
| `self.fuel *= 2` | `max(0, min(100, self.fuel * (2)))` |
| an attribute with no clamp | the inner expression, unwrapped |

The right-hand side is always parenthesized under a compound operator, so `-=` and `/=` group correctly. Clamps come only from `ClampMin` and `ClampMax` on the attribute; a `clamp` line in the script is a parse error. A `return` is never clamp-wrapped, since nothing is written.

## Statements

A body is a list of line-delimited statements. A newline ends a statement; there are no semicolons, and no statement spans two lines.

```text
# a comment runs to the end of the line; blank lines are ignored
require self.fuel < 100             # zero or more require lines
self.fuel += $Amount                # zero or more assignments, applied in order
return self.fuel                    # at most one return
```

**Assignment**: `self.<Attr> <op> <expression>` or `source.<Attr> <op> <expression>`. The left-hand base is only `self` or `source`; `ref(...)` may not appear on the left. `<op>` is one of `=`, `+=`, `-=`, `*=`, `/=`, and the four compound forms require an `int` or `float` attribute. Statements run in order and a later one sees an earlier one's write.

**Require**: `require <boolean expression>`. Lowered to the function's invoke policy, not to a runtime branch: every `require` is evaluated before any assignment runs, a failure rolls the whole invocation back, and several lines combine with `and`. The grammar is under [require](#require) below.

**Return**: `return <expression>`. At most one per effect, and a slot rather than a statement: the server evaluates it after every assignment has run, wherever the line sits. A second `return` is the error `this effect already returns a value on line N`, naming the first.

Comments start with `#`. `//` is not a comment and fails to parse.

:::warning[A wrapped line is two statements.]
An editor with soft wrap shows one long line as two; the parser does not. A statement broken after an operator fails with `expected a value`; broken before one, the first line parses and the second fails with `a statement must be an assignment ...`. Keep each statement on one line.
:::

## Expressions

| Form | Example | Notes |
|---|---|---|
| number | `42`, `3.14`, `.5` | No exponent form, no hex, no leading `+`. A negative is unary minus. |
| string | `"text"` | Escapes are `\"`, `\\`, and `\n`; any other backslash is kept literally. A newline inside a string ends it as unterminated. |
| bool, null | `true`, `false`, `null` | |
| property read | `self.Fuel`, `source.Str`, `ref($ally_id).hp` | See the bases below. |
| parameter | `$Amount` | Letters, digits, underscores; not starting with a digit. |
| unary | `-x`, `!flag` | |
| binary | `a + b`, `a && b` | Precedence below. |
| grouping | `(a + b) * c` | |
| builtin call | `max(0, self.fuel - 5)` | Any bare `name(...)`; the names are under [builtins](#builtins). |
| function call | `fn:MaxFuelBonus()` | Reads another Model function's return value. |
| raw | `raw("self.hp - 1")` | Spliced verbatim, unparsed, one string literal. |

Precedence, loosest to tightest, with same-level binary operators left-associative: `||`; `&&`; `==`, `!=`, `<`, `>`, `<=`, `>=`; `+`, `-`; `*`, `/`, `%`; unary `!` and `-`. `raw(...)` is the loosest operand of all, so it is parenthesized whenever an operator touches it: `10 - raw("self.str - 1")` becomes `10 - (self.str - 1)`.

## Property bases

| Form | Validated against | Lowers to | Effect on the function |
|---|---|---|---|
| `self.<Attr>` | the target type's attributes | `self.<key>` | none |
| `source.<Attr>` | the source type's attributes when Source Container Type is set, else the target's | `ref($source_id).<key>` | injects a required `source_id` parameter and marks the effect cross-entity, on a read as much as a write |
| `ref(<expr>).<Attr>` | nothing | `ref(<expr>).<Attr>` verbatim | marks the effect cross-entity; injects nothing, you supply the id |

`ref(...)` is the escape hatch: its attribute is passed through exactly as written, so spell the server key yourself. It makes the effect cross-entity for the inferred policy without ever needing a Source object at apply time; `source.` needs one.

## Attribute names are case-sensitive

An attribute answers to exactly two spellings: the property name as declared (`Fuel`) and its server key (`fuel`, or the `CrowdyKey` override). Both are compared case-sensitively, and `self.FUEL` is `unknown attribute`, with a "did you mean" when a case-insensitive near miss exists.

:::warning[Mixing the two spellings of one attribute on one base in one effect is an error, not a warning.]
`self.Fuel = self.fuel + 1` is refused as two spellings of the same attribute. `self` and `source` are tracked separately, since they name attributes on different containers.
:::

## Hard limits

Rejected with a diagnostic, never silently truncated: a source of more than 100,000 characters, a parse depth of 256, more than 4,000 nodes in the tree, a lowering depth of 400, and more than 4 timers per effect. The two depth limits produce two different messages, `expression nested too deeply` from the parser and `effect expression is nested too deeply to compile` from the lowering; a flat expression that parses can still lower into a deep left-nested chain. The server adds its own: 4 permission effects per function, and 1,000 items in any list a builtin handles.

## Parameters

A **tuning parameter** (a magnitude on the asset) is referenced as `$Name`. Each lowers to one function parameter with the value type the asset declares. A freshly added parameter starts Required because its Default Value is empty; untick Required only after you type a default, since an optional parameter with no default is the error `the magnitude 'x' is optional but has no default value`. A parameter with a Curve is never required at the call site. Using an undeclared `$name` is a warning, so an effect still compiles while you add the parameter; declaring one and never using it is also a warning, and the parameter is still emitted, so callers must still supply it. Parameter order is declaration order, then the injected `source_id` last.

The server **injects** seven values into every body, policy condition, and notification expression; read them, never declare them ([the server's list](/game-api/game-models#authority-deciding-who-may-invoke-a-function)):

| Name | Value |
|---|---|
| `$caller_user_id` | The invoking user. |
| `$current_turn_user_id` | Whose turn it is in the session. |
| `$self_owner_id` | The acting container's owner. |
| `$session_id` | The session the invoke ran in. |
| `$self_container_id` | The acting container's own id. |
| `$app_id` | The app. |
| `$session_channel_name` | The session's channel. |

The compiler refuses a magnitude or a timer parameter named after the first five, or `source_id` or `notify_id`, with the error `the magnitude name 'x' is reserved by the effect layer`. `source_id` is what a `source.` read injects; `notify_id` is a retired name kept reserved. A magnitude named `app_id` or `session_channel_name` compiles locally and collides on the server, so avoid those two as well.

## `require`

A `require` line lowers structurally when it is a keyword or a permission call, and to a `condition` leaf otherwise. Any other bare word is `unknown requirement`.

| Write | Server leaf |
|---|---|
| `owner` or `owner_of_self` | `owner_of_self` |
| `my_turn` or `is_current_turn` | `is_current_turn` |
| `host` or `is_host` | `is_host` |
| `participant` or `is_participant` | `is_participant` |
| `automation` or `is_automation` | `is_automation` |
| `anyone` | an always-true `condition`: any signed-in player |

Argument-carrying leaves, whose arguments must be literals: `feature("premium")` or `tier_feature("premium")`; `grid_permission("access")`, with an optional grid id second; `group_permission(42)`, with an optional permission name second. `&&`, `||`, and `!` become `and`, `or`, and `not`, chains of one operator flattened into one node. Anything else, a comparison, arithmetic, a builtin, becomes `{"type":"condition","expression":"..."}`, and a condition may read `self`, the call's parameters, and the injected parameters.

```text
require host && self.capturestate == 1
```

becomes `{"type":"and","rules":[{"type":"is_host"},{"type":"condition","expression":"self.capturestate == 1"}]}`.

With no `require` at all the compiler infers a gate: `owner_of_self` for a body that touches only `self`, `is_participant` the moment `source.` or `ref(...)` appears anywhere, none for an Other-effects-only function that is not automation-invocable, and `is_automation` when it is. An authored `require` is added to the inferred gate with `and`, unless what you wrote already constrains the caller on every path, in which case the inferred gate is dropped. So `require $damage > 0` never loosens who may call. What the server does with the policy, and why an empty one clears the server's, is [Invoke policies](./invoke-policies.md).

## Return values and `fn:`

```text
return self.fuel
return if(self.fuel > 0, 1, 0)
return fn:MaxFuelBonus()
```

At most one `return`, evaluated after every assignment. The asset's Return Type wins; when it is None and the return is a bare `self.` or `source.` read, the attribute's own type is used; anything else warns that the value arrives untyped. Declaring a type that disagrees with the returned attribute warns, except widening `int` to `float`. An Other-effects-only effect with no `return` is an error, since nothing could reach it; also automation-invocable downgrades it to a warning. Returning an owner- or hidden-visibility attribute warns: the caller may not be allowed to see it.

`fn:<name>(args...)` reads the named function's return value and nothing else: none of its assignments, signals, or timers run. The compiler warns when it knows the callee and the callee returns nothing or has writes you might have expected to happen. An Other-effects-only function is exactly what `fn:` is for. The calling side is on [Functions and return values](./functions-and-return-values.md).

## Signals

A signal is declared on the asset, not in the script: an entry in Signals with a Name of letters, digits, and underscores, unique on the effect. It lowers to a channel notification whose payload is `csg:<Name>:` followed by the container id, and on arrival the container the effect ran on runs a parameterless `OnSignal_<Name>` on every client that has it bound; other containers of the type do not, and anything else listens on **On Crowdy Signal**. An effect may declare signals and change nothing else. Model-changed notifications are separate and automatic: when the Notification Carrier is not None and the effect has at least one assignment, the compiler appends the notification that makes peers re-pull; a read-only effect authors none, so a question never makes everyone re-pull. Delivery is on [Change pings and pull](./change-pings-and-pull.md#signals).

## Timers and automations

A timer is one delayed invocation armed when the effect commits, in the same transaction as its writes: a rolled-back effect schedules nothing, a committed one fires exactly once, and a client cannot cancel it. Its `FunctionName` must be autonomous-invocable; `DelayMs` and `DedupeKey` are lowered as a number and a quoted string; `DelayExpression` and `DedupeKeyExpression` are sent verbatim, so a literal there needs its own quotes; re-arming a `DedupeKey` replaces the pending timer; `Params` are evaluated when the timer is armed, not when it fires. A timer declared on a function arms on every commit of that function.

Ticking Run Automatically marks the function autonomous-invocable and emits an automation with one of four triggers: every N milliseconds, a cron expression, a watched property's change (mind Observe Writes From: `Any` sees direct writes and writes made inside functions, `Direct` sees only the former, and most game logic writes from inside functions), or another function's commit. The safety budget is always emitted with the asset's defaults: Max Targets 50, Gas Limit 20000, Run Timeout 200 ms, Max Runs Per Minute 120, Failure Threshold 5, Cooldown 30000 ms. Pairing Run Automatically with Other effects only warns when the effect also returns nothing; an automation entry point's documented scope is Server only. The server clamps the gas limit to a platform ceiling, so a higher figure is authored and then not used. The Details panel for all of this is [Automations](./automations.md).

## Builtins

The compiler passes any unrecognised call through verbatim, so a misspelled builtin is not caught locally; the server rejects it when the function is uploaded, and argument counts are checked then too. `max` and `rand_int` take exactly two arguments and `rand` takes none. The [Game API's expression language](/game-api/game-models#the-expression-language) documents the same set.

General: `max(a,b)`, `min(a,b)`, `abs`, `floor`, `ceil`, `round`, `clamp`, `pow`, `sqrt`, `len`, `concat`, `to_int`, `to_float`, `to_string`, `rand`, `rand_int(a,b)`, `not`, `is_null`, `coalesce`, `if(cond, then, else)`, and `now()` (int milliseconds, bound once per invocation so every `now()` in one call agrees).

Lists, all pure, each returning a new list: `at(list, i)` (error out of range), `set_at(list, i, v)`, `append(list, v)`, `remove_at(list, i)` (error out of range), `index_of(list, v)` (or -1), `array(v1, v2, ...)`. A never-written property reads as the empty list to every one of these except `remove_at`, which errors. The 1,000-item cap is enforced inside them.

Grid and permission: `has_grid_permission(user_id, key [, grid_id])`, `has_chunk_permission(user_id, key, cx, cy, cz [, mode])`, `grid_at(cx, cy, cz [, mode])`, `grid_contains(grid_id, cx, cy, cz)`, `grid_min(grid_id, axis)`, `grid_max(grid_id, axis)`. `mode` is `"first"`, `"smallest"`, or `"largest"`; `axis` is `"x"`, `"y"`, or `"z"`. These two literals are the only builtin arguments checked locally, and a bad one is a warning.

:::warning[Only the grid mode and axis literals are checked before upload.]
Every other builtin's name and argument count is checked when the function is synced. A `maxx(a, b)` compiles clean in the editor and fails at Sync to Server.
:::

There are no loops, no local variables, no map type, no hashing. A scratch attribute plus read-your-writes is the substitute for a local; see the idioms.

## What is atomic

Four shapes compile to one statement that recomputes from the row's live value, so a caller that loses a race re-evaluates against what the winner committed, with no lock and no retry: `p = if(index_of(p, X) < 0, append(p, X), p)` is an exactly-once add to a set; `p = if(index_of(p, X) >= 0, remove_at(p, index_of(p, X)), p)` an idempotent remove; `p = append(p, X)` lossless but not exactly-once; `p = p + N` and `p = p - N` on integers lossless. Everything else that reads the property it writes takes a short row lock, still correct, serialising callers on a hot container. Two properties written by one function commit together; two separate invokes never do. A very hot single property is refused rather than served late, with a retryable platform-blamed error. The server's own account is [Concurrency](/game-api/game-models#concurrency-two-players-writing-the-same-property).

## Idioms

- **A scratch attribute stands in for a local.** Declare an ordinary attribute, write the intermediate value, read it back on later lines. Snapshot a decision before mutating what it reads, or a later line re-evaluates against a value an earlier one changed.
- **Per-write conditionality is `if(cond, new, old)`.** `require` gates the whole invocation; to make one write conditional while the rest land, assign the old value in the else branch.
- **Epoch guards neutralise a stale timer.** Bump an epoch attribute when the situation changes and have the delayed function `require` the epoch it was armed with, bound as a timer parameter at arm time.
- **Session-keyed sticky state resets itself.** Compare a stored session id against `$session_id`; per-match state that resets when a new session starts, with nothing to clean up.
- **Scheduled work computes elapsed time.** A schedule does not run while the app has no player, and its missed runs are never made up, so store `now()` in an attribute on each run and advance by the difference, never by a fixed step per run. [Automations](./automations.md#a-schedule-the-village-night) shows the shape.
- **Derive, then commit.** Compute every derived value into scratch attributes, then assign the real ones from them, so the derivation reads one consistent snapshot.

## Diagnostics

Parse errors:

| Message | Cause |
|---|---|
| `a statement must be an assignment (self.<attr> / source.<attr> <op> ...), a 'require', or a 'return'` | The line starts with something else; `ref(...)` cannot be a target. |
| `expected an assignment operator (=, +=, -=, *=, /=)` | Missing operator after the attribute. |
| `clamp bounds are inherited from the attribute's ClampMin/ClampMax; do not write a clamp line` | Set the meta on the property instead. |
| `this effect already returns a value on line N` | One `return` per effect. |
| `unexpected trailing tokens after the expression / require condition / return expression` | Two operands with nothing between them, usually a missing operator: `self.fuel += $Amount 5`. |
| `expected a value` | An operator or `)` where an operand belongs, or a line broken after an operator. |
| `expected ')'`, `expected '(' after ref`, `expected '(' after raw`, `expected '.' then an attribute name`, `expected an attribute name`, `expected ':' after fn`, `expected a function name after 'fn:'` | A form left incomplete. |
| `raw(...) takes a single string literal` | |
| `unterminated string literal` | Strings cannot span lines. |
| `expected a parameter name after '$'` | |
| `unexpected character 'c'` | A character the language has none of: a `;` at the end of a line, `[ ]`, `{ }`. (`//` is not this error; it fails as a statement or as a value.) |
| `expression nested too deeply`, `effect expression has too many terms`, `effect script is too large` | The hard limits. |

Lowering errors:

| Message | Cause |
|---|---|
| `unknown attribute 'X' on container type 'T'` | Wrong name or wrong case; a "did you mean" follows a near miss. |
| `'A' (line N) and 'B' (line M) are two spellings of the same attribute` | Pick one spelling per base. |
| `operator cannot apply to the <type> attribute 'k'; only int/float attributes support += -= *= /=` | Use `=` with an explicit expression. |
| `division by zero: ...` | A literal `0` divisor. |
| `the literal N does not fit in the int attribute 'k'` | The int64 range. |
| `unexpected identifier 'x' in an expression` | A bare word outside a `require`. |
| `unknown requirement 'x'`, `requirement 'x' expects a literal for ...` | Not a keyword leaf; a non-literal leaf argument. |
| `'x' is not an invoke scope`, `'x' is not a return type` | Use the asset's enums. |
| `the source container type 'T' is not a known Game Model container type` | Fix or clear Source Container Type. |
| `the magnitude name 'x' is reserved by the effect layer and cannot be declared` | A reserved name. |
| `the magnitude 'x' is optional but has no default value, so a caller that omits it sends nothing at all` | Type a default, or tick Required. |
| `the effect has no target container class set`, `the target class 'X' carries no CrowdyContainer tag` | Set Container Class to a tagged container. |
| `this effect is callable only from other effects but returns nothing` | Add a `return`, or widen Callable From. |
| `the signal name 'x' is not usable`, `the signal 'x' is declared more than once on this effect` | Letters, digits, underscores; unique names. |
| `this effect declares N timers, but a Model function may declare at most 4` | |
| `a timer has no function name` | |
| `the timer parameter name 'x' is reserved by the effect layer`, `... is declared twice on one timer` | |
| `effect expression is nested too deeply to compile` | The lowering depth limit. |

Warnings, which compile but are usually real:

| Message | Meaning |
|---|---|
| `parameter '$x' is used but not declared as a magnitude` | Add the magnitude before shipping. |
| `the magnitude 'x' is declared but never used` | It is still emitted, and callers must still supply it. |
| `'k' is written on line N and overwritten here before anything reads it` | The earlier write does nothing; a `require` between them is not a read. |
| `this effect returns a value but declares no return type` | The value arrives untyped. |
| `this effect declares a return type of 'X' but returns 'k', which is 'Y'` | The caller decodes as the declared type. |
| `this effect declares a return type of 'X' but returns nothing` | Every invocation answers the type's default. |
| `a timer parameter has an expression but no name, so it will not be sent` | Name the row or remove it. |
| `fn:x(...) ... returns nothing, so this call has no value to read` | |
| `fn:x(...) reads that function's return value only, so the state it writes is not changed here` | |
| `the returned value reads 'k', which is owner-visible / hidden-visible` | The return discloses state a plain read would hide. |
| `the returned value calls 'grid_at', which reads grid state` | |
| `'grid_at' expects a mode of "first", "smallest", or "largest"`, and the axis form | |
| `this effect runs automatically but is callable only from other effects` | Emitted when the effect also returns nothing. Use Server only for an automation entry point. |

## Checklist

1. Container first: the target class carries `CrowdyContainer`, every attribute you touch exists with the exact spelling and type, and `ClampMin` and `ClampMax` are on the attribute, never in the script.
2. Decide the roles. A `source` of a different type needs Source Container Type.
3. Write the body: requires, assignments in execution order, at most one `return`.
4. Declare every `$param` as a tuning parameter with the right type and default.
5. Pick the gate deliberately. If you rely on the default, confirm it is the one you want.
6. Set Callable From and Return Type for a shared formula or an answer.
7. Check concurrency: if two players can run this on one container at once, use an atomic shape.
8. Snapshot before mutating anything a later line's decision reads.
9. Save and read the validation output; errors block, warnings are usually real.
10. Sync the schema before invoking anything. [Game Models authoring](../studio/game-models-authoring.md).

## What does not exist

No `if`/`else` statements, blocks, or `elseif`; only the `if(cond, then, else)` expression. No loops. No local variables. No `clamp` statement. No multi-line statements, no `//` comments, no semicolons. No `ref(...)` on the left of an assignment. No indexing syntax; `at(list, i)` instead. No map type, hashing, or string interpolation. No second `return`. No compound operators on a `bool`, `string`, `array`, `object`, or `container_ref` attribute. No exponent or hex literals. No writing to a container other than `self` and `source`. And `fn:` never runs the callee's writes, signals, or timers.

## Related

- [Authoring effects](./authoring-effects.md): the Details panel this language lives in.
- [Invoke policies](./invoke-policies.md): what the server does with a `require`, and the empty-policy rule.
- [Functions and return values](./functions-and-return-values.md): calling a function and reading its answer.
- [Automations](./automations.md): the Details panel for timers and automations.
- [The expression language on the Game API](/game-api/game-models#the-expression-language): the server's own copy of the builtins.
