# SDL Sidebar Nav — implementation notes

Recorded against `test-site-sdl.squarespace.com` (Squarespace 7.1, header layout `navCenter`, commerce enabled, customer accounts on).

---

## The central decision: the header *is* the sidebar

The obvious approach — build a new `<aside>` and clone the header's contents into it — breaks three things at once:

1. The cart node carries live Squarespace bindings. A clone shows a frozen quantity.
2. A lot of 7.1 CSS is scoped under `.header` or `.header-display-desktop`. Cloned nodes outside that ancestry lose their theme colours, button styles and icon borders.
3. Customer accounts, language pickers and third-party header widgets bind on load to the nodes that exist then.

So `#header` itself becomes the sidebar. Its children are rearranged into zone wrappers that stay *inside* `.header-display-desktop`, which keeps every descendant selector matching. Nodes are **moved**, never copied, so their bindings come with them.

The one exception is the nav list, which is rebuilt — see below.

### Reversibility

Every moved node is recorded first:

```js
homes.push({ node, parent: node.parentNode, next: node.nextSibling });
```

`restoreAll()` walks the list backwards and re-inserts each node before its recorded next sibling. Crossing back below the breakpoint therefore restores the header byte-for-byte, including `.showOnDesktop` / `.showOnMobile` wrappers, so Squarespace's own media queries keep working. Verified live: after a desktop → mobile → desktop round trip the title is back in `.header-title-nav-wrapper`, the cart is back inside `.showOnDesktop`, and the native folder anchor and Back control are restored.

---

## Recorded header DOM (7.1, 2024+ markup)

```
#header.header
├── .sqs-announcement-bar-dropzone
└── .header-announcement-bar-wrapper
    ├── a.header-skip-link
    ├── .header-border / .header-dropshadow
    └── .header-inner
        ├── .header-background
        ├── .header-display-desktop
        │   ├── .header-burger                      ← shown when the overlay has non-nav items
        │   ├── .header-title-nav-wrapper
        │   │   ├── .header-title > .header-title-text > a#site-title
        │   │   └── .header-nav > .header-nav-wrapper > nav.header-nav-list
        │   │       ├── .header-nav-item--folder
        │   │       │   ├── button.header-nav-folder-title[data-href][aria-expanded][aria-controls]
        │   │       │   │   ├── span.header-nav-folder-title-text
        │   │       │   │   └── span.header-dropdown-icon > svg
        │   │       │   └── div#<folder>.header-nav-folder-content
        │   │       │       └── .header-nav-folder-item > a > span.header-nav-folder-item-content
        │   │       └── .header-nav-item--collection > a
        │   └── .header-actions.header-actions--right
        │       ├── .user-accounts-link.customerAccountLoginDesktop
        │       ├── .header-actions-action--social > a.icon × n
        │       ├── .showOnMobile  > .header-actions-action--cart
        │       ├── .showOnDesktop > .header-actions-action--cart
        │       └── .header-actions-action--cta > a.btn
        ├── .header-display-mobile                  ← mirrors the above
        └── .header-menu (overlay)
            └── nav.header-menu-nav-list
                ├── .header-menu-nav-folder[data-folder="root"].header-menu-nav-folder--active
                │   └── .header-menu-nav-folder-content
                │       ├── .header-menu-nav-wrapper
                │       │   ├── .header-menu-nav-item > a[data-folder-id="/plugins"]
                │       │   └── .header-menu-nav-item--collection > a
                │       ├── .header-menu-actions.social-accounts
                │       └── .header-menu-cta
                └── .header-menu-nav-folder[data-folder="/plugins"]
                    └── .header-menu-nav-folder-content
                        ├── .header-menu-controls > a[data-action="back"]
                        └── .header-menu-nav-item × n
```

Useful facts:

- `#header` is `position: fixed; z-index: 10` with `data-header-style="dynamic"`, and `#page` carries no padding of its own — the header overlays the content. Clearance comes from an inline `padding-top` on the *first section*, which matters a lot (see below).
- Folder titles are `<button data-href>`, not links. 7.1 folders are containers, not pages, so the plugin renders a button and never a link — unless the title really is an `<a href>`, in which case it splits into a link plus its own disclosure button.
- The desktop nav is `inline-flex` with no gap; spacing comes from item margins.
- 7.1 exposes `--site-navigation-font-*`, `--siteBackgroundColor`, `--navigationLinkColor` and the `--solidHeader*` pair (`BackgroundColor`, `NavigationColor`) on `:root`. The `solidHeader` pair is the one to use — see *Dynamic headers* below.

---

## Gotchas found the hard way

### `[data-icon]::before { content: attr(data-icon) }`

Squarespace ships this rule for its own icon set. A `data-icon="caret"` attribute on the disclosure span made the browser print the literal word **caret** next to every folder — and because the span is `inline-flex`, the generated text became a flex sibling that squeezed the SVG to **zero width**. The visible symptom was a word where the chevron should be.

Fix: namespace the attribute (`data-sdlsn-icon`) and belt-and-braces it with

```css
.sdlsn__icon::before, .sdlsn__icon::after { content: none !important; }
```

`_harness.html` deliberately reproduces the Squarespace rule so the regression cannot come back unnoticed.

### `flex: 1 1 auto` on the centre band

With the nav in the centred band, `flex: 1 1 auto` + `min-height: 0` let the band shrink below its content when a folder was open. The nav then overflowed in both directions and collided with the logo above and the button below.

`flex: 1 0 auto` fixes it: the band still grows to fill spare space and centre a short nav, but never shrinks below its content — so a tall open folder pushes the total past the viewport and the sidebar's own `overflow-y: auto` takes over, which is what a column of links that outgrows the window should do.

### Sub-pixel wrapping in the icon row

A login link, a cart and three social icons come to ~214px against ~215px of available width in a 280px sidebar — close enough that the row wrapped or not depending on rounding. A row that *sometimes* wraps reads as a bug.

Social icons now get their own row by default (`styles.socialInline: false`). Two icon rows in the same band are spaced by `actionGap` rather than the larger `zoneGap`, via `.sdlsn__actions + .sdlsn__actions { margin-top: calc(actionGap - zoneGap) }`.

### Squarespace pads the first section by the header height

Its header controller writes an **inline** `padding-top` on the first section equal to `#header.offsetHeight`, so a fixed top bar cannot cover it. Normally that is ~62px. Turn the header into a full-height column and Squarespace obligingly writes **895px** — a viewport of blank space above the hero.

A stylesheet `!important` outranks a plain inline style, so `html.sdlsn-on .sdlsn-first-section { padding-top: 0 !important }` fixes it with no observer, and keeps working when Squarespace re-measures on resize. `unmount()` writes the real header height back, so `destroy()` leaves no trace.

### Never zero padding on the action anchors

The first pass reset `margin: 0; padding: 0` on `.header-actions-action > a` to kill Squarespace's viewport-relative spacing. But on the CTA, *the anchor is the button* — zeroing its padding flattened "Enroll Now" from 115×38 to a 215×18 hairline. Reset padding on the wrappers only; margins on the anchors.

### Dynamic headers recolour themselves

With `data-header-style="dynamic"`, Squarespace swaps `data-section-theme` on `#header` as sections pass behind it and recolours the header text to suit — cream over a dark hero, near-black over a light one.

A sidebar has nothing behind it. Inheriting the live colour is wrong by construction, and on this test site it produced a cream logo on a cream column: invisible, while the rebuilt nav (which uses our own `--sdlsn-fg`) stayed black. Two changes:

1. Source colours from `--solidHeaderNavigationColor` / `--solidHeaderBackgroundColor` — the pair Squarespace uses when the header is *not* overlaying anything, which is exactly our case.
2. Pin them onto the moved elements with `!important`, so later theme swaps cannot undo it. Buttons are excluded — they carry their own fill and border.

Colours are resolved through a throwaway probe element, because these variables hold `hsla()` and the border tint needs `rgb` channels.

That fixes text. The **button** breaks one level up: Squarespace copies the overlaid section's `data-section-theme` (plus a matching class) onto `#header`, and the theme CSS repaints the button for that backdrop. The identical CTA rendered white-on-black on the home page — whose hero is `data-section-theme="dark"` — and brand red (`rgb(235,40,50)`) on every other page, where the header carries no theme at all.

The rule (`styles.headerTheme: 'auto'`): if the header's theme equals the **first section's** theme, it was inherited from the overlay, so drop the attribute and the class and let the header fall back to its default presentation — which is exactly what non-overlay pages already show. A theme that *differs* was configured on the header itself, so leave it. `'keep'` opts out; a theme name pins one.

A `MutationObserver` on the header's `class` and `data-section-theme` holds the decision, because a dynamic header re-themes itself while scrolling. Re-stripping produces no further mutation to react to, so it cannot loop. `unmount()` puts the attribute and class back.

### Detecting the editor

Two independent signals, because neither alone is enough: Squarespace's edit-mode classes are definitive but only appear once editing starts, while `location.ancestorOrigins` (with `document.referrer` as the fallback) catches the editor's `/config` iframe from the first paint. A `MutationObserver` on both `<html>` and `<body>` classes tracks it in both directions, so entering *and* leaving edit mode without a reload takes effect immediately.

### `box-sizing` on `#header`

`width: 280px` plus a 1px border made the header 281px wide while the content wrapper was inset by exactly 280px — a 1px overlap. `box-sizing: border-box` on the header rule.

### Announcement bar

The bar is a child of `#header`, so turning the header into a 280px column would have squeezed it. If it has height, it is moved to be the first child of `<body>` (full width, in normal flow above the wrapper) and its height is written to `--sdlsn-top`, which offsets the sidebar. A `ResizeObserver` keeps the offset correct if the bar rewraps.

### `overflow-x: clip`, not `hidden`

Some 7.1 sections size themselves off `100vw`, which overflows once the wrapper is inset. `hidden` would create a scroll container and break `position: sticky` inside it; `clip` does not.

### The mobile drill-down handler

Squarespace opens a mobile folder from `a[data-folder-id]`. Rather than fight that listener, the plugin **replaces the anchor** with its own `<button>` — the handler goes with the element it was bound to. Sub-items are cloned from the matching `.header-menu-nav-folder[data-folder="…"]`, which is then hidden along with the Back control. Teardown puts the original anchor back.

### `transitionend` is not guaranteed

If a panel is `display: none`'d mid-animation the event never fires and the panel would be stuck with an inline height. Every height animation registers a `setTimeout` fallback alongside the listener, and whichever fires first cancels the other.

---

## Font matching

Rather than trusting `--site-navigation-font-*` to exist on every template, the plugin reads the computed style off a real nav link **before hiding it**, and writes it to `--sdlsn-nav-*`. CSS uses those with the Squarespace variables as a fallback:

```css
font-size: var(--sdlsn-nav-fs, var(--site-navigation-font-font-size, 1rem));
```

The probe prefers `.header-nav-item--collection > a` over a folder's first child anchor — the latter is a dropdown item with different styling.

---

## Breakpoint handling

One number, `cfg.breakpoint`, decides everything: `innerWidth > breakpoint` means sidebar. Deriving it from the computed display of `.header-display-mobile` was tried and rejected — once mounted, the plugin's own CSS hides that element, so the reading becomes self-referential and the switch gains hysteresis.

At boot only, if the native mobile header is already showing at a width above the configured breakpoint, the breakpoint is raised to the current width. That covers sites where a long nav makes 7.1 switch early, without the feedback loop.

---

## Testing

`_harness.html` is a recorded copy of the header above, served by `dev-server.js` on `localhost:7793`. It includes the `[data-icon]::before` rule, the 767px desktop/mobile swap, `data-folder` wiring and a stand-in burger, and takes a base64 config via `?cfg=`.

Note that Chrome blocks subresource requests from a public `https://` page to `localhost`, so the plugin cannot be pulled off the dev server into a live Squarespace page. For live testing, push and load from a commit-pinned CDN URL:

```
https://cdn.jsdelivr.net/gh/square-design-lab/Sidebar-Nav@<sha>/sidebarNav.js
```

### Verified on the live site

Sidebar mount at exact width with no horizontal overflow; nav rebuilt from the real header with correct hrefs; accordion open/close with height animation and `aria-expanded`; native nav, actions, burger and overlay hidden with no duplicate cart and the live cart quantity intact; caret and plus/minus icons; left and right side; centre alignment; dividers; `active: 'underline'`; per-element band placement; Escape closing a folder and restoring focus; desktop → mobile → desktop round trip restoring the header exactly.

Second and third passes, against the real Code Injection install rather than an injected build: first section flush at `padding-top: 0`; the CTA matching the native header button exactly (`10.2px 22.1px`, 115×38, same colour and fill) and sitting last, after the icon and social rows; logo and nav both at the resolved dark colour on a solid cream column, unchanged after scrolling 1000px past the dark hero; `aria-current` and folder auto-open on `/summary-block`; sidebar still pinned at `top: 0` full height under scroll; and entering edit mode (`body.sqs-edit-mode-active`) tearing the sidebar down — native nav back, title back in `.header-title-nav-wrapper`, wrapper padding cleared — then rebuilding on exit.

Section-theme pass: on the home page the header's inherited `dark` theme is dropped (`data-section-theme` gone, class gone) and the CTA renders brand red, matching `/store` and `/summary-block` where the header never had a theme; `destroy()` hands `dark` back and the native top bar returns to its white overlay button; `refresh()` re-applies. Logo, cart icon and sidebar fill are unchanged by the swap.

### Verified on the harness

Mobile accordion at 375×812 (native header untouched, folders expanding in place, Back control and drill-down folder hidden, no pseudo-content on the icon); announcement bar lifted to full width with the sidebar offset below it; and — with a second folder added to the harness for the purpose — one-open-at-a-time on both desktop and mobile, with `singleOpen: false` correctly allowing several at once.
