# Pause design notes

Who uses it: an older person who has just been told to send money in a hurry, and the son or daughter who gets the alert. Judges open it on a phone and give it two minutes.

The feeling to aim for is calm authority: a bank's safest screen, not a crypto dashboard. Every screen should make sense without reading an explanation.

## Tokens

Defined in `web/app/globals.css`, with the second-pass overrides in `web/app/pause.css`.

| Role | Value | Used for |
| --- | --- | --- |
| Paper | `#f7f3ea` | Page background |
| Surface | `#ffffff` | Cards, phones |
| Ink | `#0f1f1a` | Text, dark bands, the balance card |
| Muted | `#52605a` | Secondary text (6.0:1 on paper) |
| Action | `#17604f` | Primary buttons, links (7.4:1 on white) |
| Held | `#e8930c` solid, `#8f4a04` text, `#fdf1dc` background | A payment that is waiting |
| Safe | `#12b76a` solid, `#067647` text | Paid, verified, working |
| Blocked | `#f04438` solid, `#b42318` text | High risk, stopped, blocked |

Colour carries one meaning each. Amber is only ever "held", so a judge learns it once. Everything else is ink on paper.

## Type

- Headlines: Fraunces, weight 500. One word per headline may be italic.
- Interface and body: Inter, 18px base.
- Account ids, hashes, amounts: Roboto Mono.
- Five sizes: 14, 16, 18, 22, and a fluid headline.

## Words

Plain and kind. "We've paused this payment. Nothing has left her account." Never "transaction flagged". Buttons say what happens: "Stop it", "Give it more time", "This was a scam". Errors say what to do next and never show raw JSON.

## Motion

Only where it explains something: the countdown ring emptying, a held payment appearing, the talk button pulsing while it listens. All under 400ms and switched off for `prefers-reduced-motion`.

## The mark

Two vertical bars. On a held payment they sit inside a ring that empties as the hold window runs out (`web/components/Ring.tsx`). On "Call Pause" the same two bars are the talk button.

## Hero screens

1. Landing: what it is, "Try as a judge", and the two-minute judging steps above the fold.
2. `/demo`: owner and guardian phones side by side on desktop, tabs on a phone.
3. Held payment: ring, one plain sentence, the next action.
4. Verdict: level, reason, and the "Checked privately" badge that unfolds into the three signature checks.
5. `/registry`: the protection map, with the warned and blocked grades.

## Quality bar for every screen

One primary action. Text contrast at WCAG AA or better. Visible focus rings and keyboard access. Targets at least 44px. Works at 375px with no sideways scroll. Loading, empty and error states written, not default. Amounts as "0.06 NEAR" and times as "1m 40s", never raw yoctoNEAR or timestamps. Every transaction gets one sentence and an explorer link.
