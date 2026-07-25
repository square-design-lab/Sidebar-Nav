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

- `#header` is `position: fixed; z-index: 10` with `data-header-style="theme"`, and `#page` carries **no** compensating top offset — the header overlays the content. So hiding it needs no layout correction.
- Folder titles are `<button data-href>`, not links. 7.1 folders are containers, not pages, so the plugin renders a button and never a link — unless the title really is an `<a href>`, in which case it splits into a link plus its own disclosure button.
- The desktop nav is `inline-flex` with no gap; spacing comes from item margins.
- 7.1 exposes `--site-navigation-font-*`, `--siteBackgroundColor`, `--solidHeaderBackgroundColor`, `--navigationLinkColor` on `:root`.

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

Sidebar mount at exact width with no horizontal overflow; nav rebuilt from the real header with correct hrefs; accordion open/close with height animation and `aria-expanded`; native nav, actions, burger and overlay hidden with no duplicate cart and the live cart quantity intact; caret and plus/minus icons; left and right side; centre alignment; dividers; `active: 'underline'`; per-element band placement; full-width CTA; Escape closing a folder and restoring focus; desktop → mobile → desktop round trip restoring the header exactly.

### Verified on the harness

Mobile accordion at 375×812 (native header untouched, folders expanding in place, Back control and drill-down folder hidden, no pseudo-content on the icon); announcement bar lifted to full width with the sidebar offset below it.
