# Pause design notes

Who uses it: an older person who has just been told to send money in a hurry, and the son or daughter who gets the alert. Judges open it on a phone and give it two minutes.

The feeling to aim for is calm authority: a bank's safest screen, not a crypto dashboard. Every screen should make sense without reading an explanation.

## Tokens

Defined in `web/app/globals.css`. `web/app/pause.css` holds the components and `web/app/brand.css` (loaded last) holds the third pass: logo colours, clay, glass and photographs.

| Role | Value | Used for |
| --- | --- | --- |
| Paper | `#f5f3fb` | Page background |
| Surface | `#ffffff` | Cards, phones |
| Ink / night | `#0b0a1f` | Text, dark bands, the balance card (the logo's navy) |
| Muted | `#55526e` | Secondary text |
| Action | `#4f2be0`, bright `#6a45ff` | Primary buttons, links (the logo's violet) |
| Held | `#e8930c` solid, `#8f4a04` text, `#fdf1dc` background | A payment that is waiting |
| Safe | `#12b76a` solid, `#067647` text | Paid, verified, working |
| Blocked | `#f04438` solid, `#b42318` text | High risk, stopped, blocked |

Colour carries one meaning each. Amber is only ever "held", so a judge learns it once. Violet is only ever "the thing to press".

## Surfaces

- Clay (`.clay`, `.card`, buttons, the talk button): soft raised surfaces with a light top edge and a tinted inner shadow. Used for things you press or read.
- Glass (`.glass`, `.glass-dark`, the header): translucent with a blur. Used only for layers that float over a photograph or over scrolling content. Never glass on glass.
- Both fall back to solid surfaces for `prefers-reduced-transparency` and `prefers-contrast`.

## Photographs

Every page carries one, in `web/public/img`, through `web/components/Photo.tsx`. People first: older adults and their families, never stock "hacker" imagery on product screens. The landing hero is a photograph of hands holding a phone with a working Pause screen placed inside it (`HeroPhone.tsx`). The source files are 736px wide, so no photo is shown wider than about 520px.

## Type

- Headlines: Fraunces, weight 500. One word per headline may be italic.
- Interface and body: Inter, 18px base.
- Account ids, hashes, amounts: Roboto Mono.
- Five sizes: 14, 16, 18, 22, and a fluid headline.

## Words

Plain and kind. "We've paused this payment. Nothing has left her account." Never "transaction flagged". Buttons say what happens: "Stop it", "Give it more time", "This was a scam". Errors say what to do next and never show raw JSON.

## Motion

Only where it explains something: the countdown ring emptying, a held payment appearing, the talk button swelling with your voice, sections fading up once as they scroll in. Buttons scale to 0.97 on press. Interface motion stays under 400ms and switched off for `prefers-reduced-motion`.

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

## Fourth pass: restraint

- No status dots, glowing halos or looping decoration. State is said in words ("Working", "Coming soon").
- The landing page is a run of chapters. Each opens with the line a victim hears, then "The problem", then "What Pause does", and says its limit where there is one.
- Pip is the mascot: a clay guardian whose eyes are the two pause bars, wearing the amber hold ring. `web/components/Mascot.tsx` has the drawing (`Pip`) and the three.js version (`Pip3D`), which watches the pointer, blinks and ducks when pressed. The drawing shows first and stays when WebGL is missing or motion is reduced.
- Selection, caret, scrollbar and underline offset are themed from the palette.
- The header carries Home and one language switch for the whole site (`web/lib/lang.tsx`).
