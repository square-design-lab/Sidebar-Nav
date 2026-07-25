# SDL Sidebar Nav — option reference

Everything is optional. Set only what you want to differ from the defaults below.

```html
<script>
  window.SDL_SIDEBAR_NAV_CONFIG = { /* options */ };
</script>
```

---

## Top level

| Option | Default | What it does |
|---|---|---|
| `enabled` | `true` | Set `false` to switch the plugin off without removing the code. |
| `breakpoint` | `767` | The sidebar applies **above** this width. At or below it, the native header is used untouched. 767 is where Squarespace 7.1 swaps to its own mobile header. |
| `side` | `'left'` | `'left'` or `'right'`. |
| `width` | `280` | Sidebar width. Page content is inset by the same amount. |
| `widthUnit` | `'px'` | `'px'` or `'%'`. A percentage is relative to the window. |
| `align` | `'left'` | `'left'`, `'center'` or `'right'` — horizontal alignment of everything in the column. |
| `navPosition` | `'top'` | Which vertical band the nav sits in: `'top'` (under the logo), `'center'`, `'bottom'`. |
| `clipOverflow` | `true` | Clips sideways overflow on the page wrapper. Stops the horizontal scrollbar that a full-bleed section sized in `vw` can cause. Uses `overflow-x: clip`, which — unlike `hidden` — leaves `position: sticky` working. |
| `skipInEditor` | `true` | Stand down while the Squarespace editor is in edit mode, so the header stays editable. |

### `breakpoint` and your site

If your site shows its own mobile header wider than 767px (a long nav can force 7.1 to switch early), raise `breakpoint` to match — otherwise the sidebar would sit on top of a mobile header. The plugin also detects this at load: if the native mobile header is already showing at a width above your breakpoint, it defers to the site.

---

## `elements`

Which vertical band each native header element goes in. Values: `'top'`, `'center'`, `'bottom'`, `'hide'`.

| Key | Default | Matches |
|---|---|---|
| `social` | `'bottom'` | `.header-actions-action--social` |
| `cart` | `'bottom'` | the desktop cart (the `.showOnMobile` duplicate is ignored) |
| `account` | `'bottom'` | `.header-actions-action--account`, `.user-accounts-link` |
| `cta` | `'bottom'` | `.header-actions-action--cta` — your header button |
| `search` | `'top'` | `.header-actions-action--search` |
| `language` | `'bottom'` | the language picker |
| `other` | `'bottom'` | anything else Squarespace puts in `.header-actions` |

Elements your header does not have are simply skipped.

**Order within a band** is fixed: logo, nav, button, then the icon row (search, account, cart, language), then social. The logo always leads the top band.

```js
elements: { social: 'bottom', cart: 'top', account: 'hide', cta: 'center' }
```

---

## `submenu` — desktop folders

| Option | Default | What it does |
|---|---|---|
| `icon` | `'caret'` | `'caret'` (rotates), `'plus'` (becomes a minus), `'arrow'` (turns down), `'none'`. |
| `iconPosition` | `'edge'` | `'edge'` pins it to the far side of the column, `'inline'` puts it after the label, `'left'` before it. |
| `iconSize` | `13` | px. |
| `singleOpen` | `false` | `true` closes the other folders when one opens. |
| `openActive` | `true` | Open the folder containing the current page on load. |
| `duration` | `280` | Slide duration in ms. |
| `indent` | `16` | px the sub-items are indented. Ignored when `align` is centre or right. |
| `subScale` | `0.92` | Sub-item font size, as a multiple of the nav size. |

A folder whose title is a real link (rather than 7.1's usual `<button>`) gets a linked label plus its own disclosure button, so both the page and the submenu stay reachable.

---

## `mobile` — folders in the native overlay menu

The mobile header itself is left exactly as Squarespace built it. Only folders change: instead of sliding the whole menu to a sub-page with a Back button, they expand in place.

| Option | Default |
|---|---|
| `enabled` | `true` — set `false` to keep Squarespace's drill-down |
| `icon` | `'caret'` |
| `iconPosition` | `'edge'` |
| `iconSize` | `15` |
| `singleOpen` | `false` |
| `openActive` | `false` |
| `indent` | `18` |
| `subScale` | `0.82` |
| `duration` | `280` |

---

## `styles`

| Option | Default | What it does |
|---|---|---|
| `background` | `''` | `''` reads your header's own background, then your site background. Set a colour to override. A full-height column needs a solid fill. |
| `textColor` | `''` | `''` follows the header text colour. |
| `paddingX` | `32` | Side padding, px. |
| `paddingY` | `32` | Top and bottom padding, px. |
| `zoneGap` | `26` | Space between the logo, nav and action blocks, px. |
| `itemGap` | `14` | Space between nav links, px. |
| `fontSize` | `0` | `0` inherits your site's navigation font size. |
| `logoWidth` | `0` | px. `0` leaves the logo at its natural size. Useful for a wide logo built for a horizontal header. |
| `socialGap` | `16` | Space between social icons, px. |
| `actionGap` | `16` | Space between items in the icon row, px. |
| `socialInline` | `false` | `false` gives social icons their own row. `true` puts them in the icon row with the cart and login — which can wrap unevenly in a narrow column. |
| `border` | `true` | Hairline down the inner edge of the sidebar. |
| `borderColor` | `''` | `''` derives from the text colour at 14% opacity. |
| `borderWidth` | `1` | px. |
| `dividers` | `false` | Hairline between top-level nav links. |
| `hover` | `'opacity'` | `'opacity'`, `'underline'`, `'none'`. |
| `active` | `'bold'` | Current page: `'bold'`, `'underline'`, `'dot'`, `'none'`. |
| `ctaFullWidth` | `true` | The header button fills the column width. |

---

## JavaScript API

```js
window.SDL_SIDEBAR_NAV.config      // the merged config
window.SDL_SIDEBAR_NAV.refresh()   // tear down and rebuild
window.SDL_SIDEBAR_NAV.destroy()   // restore the native header
```

---

## Accessibility

- Each folder is a `<button aria-expanded aria-controls>` pointing at its panel; a closed panel is `hidden`, so it is out of the tab order and unreadable by screen readers.
- The rebuilt nav is a `<nav aria-label="Main">` containing a real `<ul>`/`<li>` list.
- The current page carries `aria-current="page"`.
- **Escape** closes an open folder and returns focus to its button.
- Focus rings use `:focus-visible` with `currentColor`, so they stay visible on any background.
- Folders open on click only. A hover-opened dropdown in a vertical column is easy to trigger by accident while moving down the list.
- `prefers-reduced-motion: reduce` turns the slide into an instant open/close.
- Squarespace's "Skip to Content" link is preserved and still the first tab stop.

---

## Troubleshooting

**The sidebar appears on top of a mobile header.** Your site switches to its mobile header wider than 767px. Raise `breakpoint` to match.

**The logo is too wide.** Set `styles.logoWidth`. The image scales down and keeps its aspect ratio.

**A section pokes out sideways, or a horizontal scrollbar appears.** Leave `clipOverflow` on.

**The sidebar has no background.** Your header is set to overlay the page, so it has no fill of its own and the plugin falls back to your site background. Set `styles.background` if you want something else.

**Nothing happens.** The plugin needs a Squarespace 7.1 header (`#header` with `.header-display-desktop`). It also stands down inside the editor while you are editing — check the live site.

**The nav is missing an item.** Only items in your real header nav appear. Check the page is in the main navigation in Squarespace, not "Not linked".
