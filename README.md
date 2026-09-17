# VEXA V15 — Cinematic Experience

Run:

npm install
npm run dev

This build uses the supplied VEXA artwork and the existing cinematic MP4s from the V11 production build.

Intro flow:
intro.mp4 -> bookslam.mp4 -> ancient sigil lock -> wrong_pass.mp4 or correct_password.mp4 -> site.

Skip cinematic only skips the current cinematic; it never bypasses the lock.

---

## V16 Cinematic Upgrade — what changed

Same gold/dark theme, same story structure — the goal here was to make the experience feel alive instead of static. No colors or copy were changed.

**New assets wired in (from the green-screen clips + clean plates you provided):**
- `public/video/cape-light-loop.mp4` / `cape-dark-loop.mp4` — the hero character is now a real-time, in-browser chroma-keyed looping video instead of a static PNG, swapping automatically with the theme.
- `public/video/transform-dark-to-light.mp4` / `transform-light-to-dark.mp4` (the second is a reversed copy generated with ffmpeg from your transition clip) — plays as a full cinematic overlay whenever the world flips.
- `public/assets/light-bg.png` / `dark-bg.png` — swapped for the clean plate versions (no baked-in character), since the character is now the animated video layer. Old versions kept nowhere else needed — safe to regenerate from the originals if you ever want them back.

**New systems (`src/main.jsx` / `src/styles.css`):**
- `ChromaVideo` — a canvas-based real-time green-screen remover (with edge feathering + spill suppression) used for all three looping/transform clips.
- `WorldFlip` — the theme toggle no longer just crossfades colors. It now plays the chroma-keyed transformation video with a radial light-burst flash and expanding rings, timed so the background swaps underneath at the flash's peak.
- Chat now triggers `WorldFlip` automatically when it detects distress in what the user types — the environment visibly responds to their emotional state, per the original concept.
- Scroll-reveal animations (Origin / Powers / Mission), magnetic buttons with a shine sweep, 3D cursor-tilt on the power cards, a soft cursor-follow glow, a gold scroll-progress bar in the nav, and a typing indicator + slide-in animation in the chat panel.

**Verified:** production build passes with no errors; smoke-tested with a headless browser through the full intro → lock → hero → theme-flip → chat flow, in both desktop and mobile viewports.

---

## V17 — Brief compliance pass (cross-checked against the TechAscent machine test)

Checked this build against the WHITEMATRIX brief. Three requirements were missing; all three are now implemented:

1. **Structured intake in the chatbot.** The chat used to jump straight into free-form LLM conversation. It now walks every visitor through **name → age → location → email**, one conversational question at a time, then asks *"So... tell me. How can I help you?"* to collect the grievance — matching the brief's example flow exactly. Only after that does it hand off to the open-ended supportive chat.
2. **Automatic email notification.** On submitting their grievance, the app now sends an email (via EmailJS, client-side, no server needed) to the hero's own address with the visitor's name, age, location, email, grievance, and submission time — subject line `Someone Needs Your Help!`, as specified. Requires the four `VITE_EMAILJS_*` / `VITE_HERO_EMAIL` values in `.env` — see `.env.example` for exact setup steps. Without them the app still runs, just skips sending (logged to console) — worth setting up before you submit, since this is one of the brief's four explicit "must haves."
3. **Powers & Abilities section.** There was unused CSS for a power-grid layout that was never actually rendered on the page. Added a real "Powers & Abilities" section (VEXA's four powers) between Threshold and Sanctum, using that existing styling.

---

## V18 — Fixed the laggy theme-flip + added more content

**Why the toggle was freezing:** the hero character and the light/dark transformation clip are both rendered through a real-time, per-pixel green-screen remover (`ChromaVideo`). That's inherently CPU-heavy (`getImageData`/`putImageData` on every frame). The bug was that the *hidden* hero-loop kept running that same expensive process in the background the entire time the transformation video was also playing on top of it — two synchronous per-frame pixel loops fighting for the same main thread at once, which is exactly what reads as "stuck."

Fixes:
1. The hero-loop clip now actually pauses (stops decoding *and* stops the pixel-keying loop) for the duration of the flip, instead of running invisibly underneath it.
2. Internal chroma-key processing resolution dropped from 360px to 240px wide — meaningfully fewer pixels to process per frame, on both clips.
3. The two transformation clips are now preloaded via `<link rel=preload>` as soon as the page loads, so the very first click doesn't also have to cold-fetch a video file before it can start playing.
4. Added `will-change`/GPU-layer hints on the two chroma canvases so the browser doesn't repaint them from scratch every frame.

Try it again after this — it should feel like a single smooth animation now rather than two competing ones. If it's still heavy on a specific device, the biggest further lever is swapping `ChromaVideo`'s manual green-screen removal for actual alpha-channel video (WebM VP9 with alpha, or HEVC-with-alpha) exported directly from the source footage — that removes the per-frame JS pixel loop entirely, at the cost of re-exporting the clips.

**More content added**, per your ask:
- New **"How It Works"** section (05) — a plain 4-step walkthrough of what happens from landing on the site to VEXA being notified, so visitors know what they're signing up for before they type anything.
- New **"Field Reports"** section (07) — three short in-character testimonial-style quotes for extra storytelling texture (clearly framed as composite/fictional, not real user data).
- A bit more copy in the hero intro, the Sanctum, and the Mission section, plus a one-line privacy note under the mission CTA.
- Nav and footer expanded to match (new section links, a two-line footer).

### Still needs your action: hosting
The brief requires a **public, hosted URL** the evaluators can open directly — screenshots or source code alone aren't accepted. This is the one piece that genuinely requires your own account/credentials, since it can't be done from inside this environment. Fastest path:

```
npm install
npm run build
```
Then drag the generated `dist/` folder onto **https://app.netlify.com/drop** (no account needed, live in ~10 seconds), or run `npx vercel --prod` from this folder if you have a Vercel account. Either way, set the same env vars (`OPENROUTER_API_KEY` + the EmailJS keys — see `.env.example`) in that platform's dashboard before/after deploy, since `.env` itself isn't uploaded. Note: the `/api/chat` proxy (see V26 below) is a serverless function, so it needs a host that supports them (Vercel does; a plain static drop like Netlify's drag-and-drop zone won't run it — use Netlify's own function support, or Vercel, if you go with OpenRouter).

---

## V19 — fixed a dead model id (this is why the AI wasn't replying)

Groq deprecated `llama-3.3-70b-versatile` (the model this project was hardcoded to) for free/developer accounts — it stopped serving requests entirely on **August 16, 2026**. Every chat request was getting a `404 model_not_found` back from Groq, which the code quietly swallows and falls back to canned filler lines, so it looked like "the AI isn't working" rather than showing an obvious error.

Switched `GROQ_MODEL` in `src/main.jsx` to `openai/gpt-oss-120b`, Groq's own recommended replacement. If this ever silently goes quiet again, the fastest way to check *why* is to open the browser console while sending a chat message — `askVexaStream()` logs the real HTTP error there, it's just hidden from the UI itself.

---

## V22 — VEXA on the home page, and the chat moved into its own portal

**Home page now has its hero.** The paged rewrite (V21) left the ring on the home page empty. Wired in the two chroma-keyed clips you supplied as a small, ambient `ChromaVideo` standing inside the ring, on the floor — cape-in-breeze for the light form, the quieter idle loop for the dark form — swapping automatically with the theme, same as everything else. It's deliberately small and `pointer-events:none`, so it reads as life in the scene rather than another button competing for attention.

**Chat is now a real page, not a floating panel.** A minimal text link — `CHAT WITH VEXA` — now sits inside the open ring. Clicking it plays your two portal clips (`portal-light.mp4` / `portal-dark.mp4`, one per theme) as the transition — the camera pushing through the ring into open sky — using the exact same forward/reverse transition system already built for About/Powers/Mission. It lands on a new `chat` page with your two cloud screenshots as its background, and the chat window itself now lives centered on that page instead of floating over whatever page you happened to be on. The panel's `×` plays the portal clip in reverse and drops you back on home, same as the corner Back button.

**Lag pass:**
- Removed an entire unused legacy asset set (`A{}` in `main.jsx`, plus the old `cape-*-loop.mp4`, `transform-*.mp4`, and static character/background art it pointed to) left over from a pre-paged build — dead weight in the bundle that never rendered.
- `ChromaVideo` now takes a `capWidth` prop instead of a hardcoded 240px processing cap. The home hero uses `capWidth={140}` — since it's shown small, there's no reason to run the per-pixel keying loop at a resolution larger than it's ever displayed at.
- Only one `ChromaVideo` instance ever exists at a time now (it unmounts entirely when you leave home or mid-transition), rather than one running hidden in the background — the exact "two pixel loops fighting over the main thread" issue V18 fixed once already, avoided here by construction.
- `index.html`'s preload hints were pointed at the two dead theme-flip clips from the old build; replaced with the two hero loops and two portal clips, since those are the ones actually needed the moment the page loads / the moment the portal is clicked.

**Note:** built/reviewed in a sandboxed environment without registry access, so this pass was verified by careful manual review (bracket/structure checks, tracing every prop through) rather than a live `npm run dev`. Run `npm install && npm run dev` and click through the ring once before shipping, same as always.

---

## V23 — actual written content on About / Powers / Mission, 6 interactive power cards

Until now those three pages were only the background artwork itself, plus the Back button — no text. This pass adds a real, scrollable content layer on top of each:

- **About** — the black/white duality copy you supplied, with a small black and white swatch dot next to each half so the concept reads visually too, not just in words.
- **Powers** — BLACK/WHITE, THE BALANCE, THE CONNECTION, then the 6 minimal cards (Echo, Vision, Memory, Connect, Adapt, Balance) with the interaction you asked for: soft white border glow, a touch more brightness, a small blurred aura behind the card, brighter text, and a 1–2px lift — nothing more, no popups. On desktop it's pure `:hover`, so it costs nothing until a pointer is actually over a card. On mobile, tapping a card sets it active and tapping a different one clears the last (one `active` class swap in React state; tapping the grid's empty space also clears it).
- **Mission** — the mission copy, an Explore · Create · Connect line where each word highlights gold on its own hover/tap, and a "Talk to VEXA" button that jumps straight to the chat page.

**How it's built, and why it shouldn't add lag:**
- The artwork image itself never moves or re-renders — it's still painted once by the existing `.page-stage` layer, which is unchanged. The new copy lives in its own `position:fixed` layer that scrolls *natively* (real browser scrolling, not JS-driven), stacked on top.
- Every hover/tap effect only touches `transform`, `opacity`, `filter`, and `box-shadow` — properties the browser can animate on the compositor without re-laying-out or repainting the rest of the page.
- The fade-in on each section (`Reveal`) is a single `IntersectionObserver` per section that fires once and disconnects — no `onScroll` handler runs on every frame anywhere in this app.
- Off-screen sections use `content-visibility:auto` so the browser can skip layout/paint work for copy you haven't scrolled to yet.
- All colors are the existing `--bg/--fg/--muted/--gold` CSS variables, so the new content re-colors itself automatically on every theme flip — no extra work happens on toggle.

Try `npm install && npm run dev`, open About/Powers/Mission, and scroll — should feel like plain, native scrolling with instant hover/tap feedback, no jank.

---

## V24 — landscape-only on mobile, plus a real mobile pass

**The gate.** VEXA's artwork is composed for landscape; a portrait phone was always going to crop and misplace things no matter how much CSS chased it. Rather than compromise the composition, touch devices (`pointer:coarse`) held in portrait now see a small "Turn your device sideways" card instead of the site — plain CSS rotate icon, no JS animation loop, checked once on load and again only on `resize`/`orientationchange` (no polling). It sits above absolutely everything, including the intro cinematic and the sigil lock. Desktops/laptops are never gated, even if the window is narrow and tall.

While the gate is up, every `<video>` on the page is paused (they'd otherwise keep decoding behind an overlay nobody can see) and whichever ones were actually playing resume automatically the moment the phone is rotated back.

**Fixed a real bug this surfaced:** several of the existing "mobile" rules (`hit-about`/`hit-powers`/`hit-mission`, the theme toggle's position, the theme-flip morph anchor, the home hero size) were written as `max-width:700px`, which doesn't distinguish a narrow *portrait* phone from a narrow *landscape* one — a small phone held sideways (e.g. an iPhone SE at 667px wide) was silently getting the portrait layout. Those are now `(max-width:700px) and (orientation:portrait)`, with their own `(orientation:landscape) and (max-height:480px)` companions tuned for short landscape screens instead of reused portrait values. Also caught and fixed: a stray `.power-grid` class name collision with old, unused CSS from a pre-paged build that was silently adding an unwanted `margin-top` to the new power-card grid — renamed to `.power-cards-grid` so it can't collide with anything.

**Other optimizations (no quality loss):**
- The chroma-keyed home hero now processes at a lower internal resolution on phones (`capWidth 100` vs `140`) — it's displayed just as small on a phone screen either way, so this only removes wasted per-pixel work, not visible sharpness.
- The About/Powers/Mission content spacer now reveals text sooner on short/landscape viewports instead of reusing tall-portrait spacing, so there's less empty scroll before the copy on a phone screen.
- Background page images now hint `decoding="async"` (so decoding never blocks the main thread) and the current theme's image hints `fetchpriority="high"` (so it's never queued behind lower-priority requests).
- `viewport-fit=cover` + a locked viewport scale in `index.html`, so the fixed cinematic layout can't be thrown off by an accidental pinch-zoom on a touch device, and content isn't cut off behind a notch.

---

## V25 — no-scroll content pages, a grounded/morphing hero, a real chat screen, and particles

**About / Powers / Mission are no longer scrolling documents.** Each is now one fixed composition sized with `clamp()`/`vh` units so it settles into whatever height is available instead of overflowing into a scrollbar - bigger type throughout, and a layout built to spread content sideways (a black/white split on About, a three-column Black · Balance & Connection · White split on Powers) rather than stack paragraph after paragraph. The three short closing sentences on About, and the three on Mission, are each joined into one flowing line instead of three separate stacked paragraphs - same meaning, one beat instead of a list. The 6 power cards are a single compact row; hovering or tapping crossfades the name into the description in the exact same spot (no popup, no resize, same interaction spec as before - soft glow, brighter text, 1-2px lift).

**The hero was floating - fixed.** Pulled a few frames from the actual chroma-key footage and measured it: the character's feet sit about 73% down the frame, meaning roughly a quarter of the clip is empty transparent space below his boots. The box was anchored as if its own bottom edge were the ground, so he read as hovering above the floor by that same amount. `bottom`/`height` are now corrected so his actual feet - not the invisible box edge - land on the floor line, and he's sized up a bit at the same time.

**The hero now morphs instead of popping between themes.** Both the dark and light hero clips stay mounted and playing at all times; switching themes simply cross-dissolves their opacity over the same 950ms as the existing background morph, instead of unmounting one and mounting the other. The hero (and the three hotspot buttons) also no longer vanish the instant a page transition starts - they're part of one `.home-fg` layer that eases out over half a second as the transition clip takes over, rather than being pulled off the DOM on frame one.

**Chat is now a full screen, not a box.** The old centered floating panel is gone. The header is two small lines next to VEXA's orb, messages are bubbles that float directly over the scene (and a particle field) with the input as a slim glass pill pinned to the bottom - no bordered container framing the conversation.

**A particle field lives behind the chat.** `ParticleField` is a single `<canvas>`, one `requestAnimationFrame` loop for the whole field (not one per particle), ~40 soft dots that drift and gently curve away from the cursor. White specks in dark mode, ink-dark specks in light mode. The loop fully stops when the tab is hidden or the chat page isn't mounted, so it costs nothing anywhere else in the app.

---

## V26 — chat Back button, corner-clumped particles, About interactivity, home particles, intro sound, less hero lag

**Fixed: Back button on the chat page did nothing.** `.chat-hd` (the header row with VEXA's orb) is a full-width, transparent bar sitting in a higher stacking layer than the shared `.back-btn` underneath it - so clicking anywhere near the top of the screen, including right on top of the Back button, was actually hitting the invisible header instead. `.chat-hd` is now `pointer-events:none` with `pointer-events:auto` restored only on its actual visible pieces (the orb, the VEXA label, the clear-conversation button), so clicks pass through the empty part of the bar to whatever's underneath.

**Fixed: chat particles starting bunched in one corner.** `ParticleField` sized its canvas by reading `clientWidth`/`clientHeight` once on mount; if that ran before the canvas had a real laid-out size (a live possibility right as the chat page takes over from the portal transition), every particle's position collapsed onto `(0,0)` for that frame, reading as "stuck in the corner" until a browser resize happened to fire and correct it. It now skips painting entirely until a `ResizeObserver` confirms a real, non-zero size - so the very first frame anyone sees already has all ~40 particles spread across their real (already-random) positions, with nothing to "distribute" after the fact.

**About page is interactive now.** A draggable Black/White balance slider sits between the duality copy and the closing line - dragging (or arrow-keying, it's keyboard-accessible) toward either side brightens that half in real time and swaps in a short line that matches wherever you left it. Pure CSS custom-property/opacity updates on pointer move, no animation loop.

**Particles added to the home screen.** Reused the existing (previously unused, dead-code) `Particles` component - gold flecks in light mode, cool pale flecks in dark mode, matching the same palette as everywhere else. It's a pure CSS `@keyframes` animation with no JS loop and no canvas, so it adds zero measurable cost to a page that's already doing real-time chroma-keying.

**Home hero lag pass.** Both the light and dark hero clips run their own real-time, per-pixel chroma-key loop at all times (needed so the crossfade always has a current frame to blend into) - but only one is ever visible. The currently-hidden clip now only does the actual pixel-keying work on every other decoded frame instead of every one, roughly halving its share of the cost, with no visible difference since it's invisible until the moment a ~950ms crossfade starts.

**Only the intro plays with sound now.** Every cinematic clip was hard-muted. The very first prologue clip (`intro.mp4`) now plays unmuted; bookslam and the password-result clips are unchanged (silent). If a browser blocks unmuted autoplay before any click, the existing "Begin cinematic" tap prompt covers it - that tap is the user gesture that lets the sound through on retry.

**Fixed: a stutter right as the reverse transition lands on home.** The two hero clips only ever existed once `page==='home'` - so every trip back from a sub-page (or from chat) mounted both fresh, from scratch, at the exact instant the reverse video finished: new `<video>` elements, metadata load, first decoded frame, first chroma-key pass, all landing in one synchronous burst right as the reverse clip handed off. That burst was the lag. A backward transition always resolves to home, so the home layer (hero clips included) now pre-mounts - invisible, non-interactive - the moment a backward transition *starts* instead of when it *ends*. The loading/decoding cost is spread across the ~1s the reverse clip is already playing, so by the time home actually needs to be shown it's already warmed up and just fades in over the same 0.5s the layer already used for its other fades.

---

## V27 — chat bot moved behind a server-side proxy (ported from vexa-version1)

**Audit: chat page images and the particle field were checked and are not broken in this codebase.** Every path `main.jsx` references under `/assets/pages/` and `/video/pages/` (including `chat-light.png`, `chat-dark.png`, and both portal-transition clips) exists on disk, is a valid, uncorrupted file, and is confirmed present in a clean `npm run build` output. `ParticleField` (the touch-interactive canvas behind the chat screen) is fully implemented and mounted on the chat page. If images or particles are missing on a *live* deployment, that deployment is most likely running an older build than this one, or was deployed without the assets folder — redeploying this project fresh should resolve it.

**Chat bot re-pointed at the same working setup as `vexa-version1`.** The chat used to call Groq directly from the browser using a `VITE_`-prefixed key, which Vite bakes into the client bundle — visible to anyone who opens devtools. Replaced with the exact architecture `vexa-version1` already used successfully:
- Added `api/chat.js`, a Vercel serverless function that proxies chat requests to OpenRouter, holding `OPENROUTER_API_KEY` server-side only.
- `askVexaStream()` in `src/main.jsx` now calls same-origin `/api/chat` instead of `api.groq.com` directly, using OpenRouter's `nex-agi/nex-n2.5-pro:free` model and the same SSE-stream parsing `vexa-version1` uses.
- `.env.example` updated to document `OPENROUTER_API_KEY` (no `VITE_` prefix — it's read server-side inside `api/chat.js`, never shipped to the browser) alongside the existing EmailJS variables.

**Email notifications are unchanged** — the EmailJS-based intake flow (name → age → location → email → grievance, then an automatic notification email) was already present and already matches `vexa-version1`'s behavior, so nothing needed porting there.

**Deploying this:** `/api/chat.js` needs a host that runs serverless functions (Vercel works out of the box — just `npx vercel --prod` from this folder). A plain static drag-and-drop host won't execute it. Either way, set `OPENROUTER_API_KEY` and the four EmailJS/`HERO_EMAIL` variables in that host's dashboard, not just in a local `.env` file — a `.env` file only affects your own machine.
