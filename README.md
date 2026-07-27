# SDL Sidebar Nav

Turns the Squarespace 7.1 site header into a fixed, full-height **sidebar** on desktop. Mobile keeps the native header — the only change there is that folders open as accordions instead of sliding the menu across to a sub-page.

Your header *is* the sidebar. The logo, cart, social icons, account link and button are moved into the column rather than copied, so the live cart count keeps updating and every bit of your theme's styling still applies.

## Files

| File | Purpose |
|---|---|
| `sidebarNav.js` | The plugin |
| `sidebarNav.css` | Styles |
| `config-generator.html` | Visual config builder with a live preview |
| `DOCUMENTATION.md` | Full option reference |
| `TECH-SPEC.md` | Implementation notes and Squarespace gotchas |
| `_harness.html` | Local copy of the 7.1 header for testing — not part of the plugin |
| `dev-server.js` | Local CORS harness server — not part of the plugin |

## Install

```html
<link rel="stylesheet" href="https://sidebar-nav.pages.dev/sidebarNav.css">
<script>
  window.SDL_SIDEBAR_NAV_CONFIG = {
    width: 280,
    navPosition: 'top',
    elements: { social: 'bottom', cart: 'bottom', cta: 'bottom' }
  };
</script>
<script src="https://sidebar-nav.pages.dev/sidebarNav.js"></script>
```

Paste into **Settings → Advanced → Code Injection → Header**. The sidebar is site-wide, so it belongs there rather than on a single page. Footer works too, but the native top bar flashes before the sidebar takes over.

Open `config-generator.html` to build a config visually. See [DOCUMENTATION.md](DOCUMENTATION.md) for every option.

## What you can set

- **Sidebar** — left or right, width in px or %, content alignment, the width above which it applies
- **Placement** — three vertical bands (under the logo, centred, bottom) for the nav and for each header element: social, cart, account, button, search, language picker. Any of them can be hidden.
- **Submenus** — caret, plus/minus, arrow or no icon; icon at the far edge, after the label or before it; one dropdown open at a time (default) or several; auto-open the folder holding the current page; slide speed and indent
- **Mobile menu** — the same accordion controls, applied to Squarespace's own overlay menu
- **Styling** — background, text colour, padding, spacing, nav size, logo width, edge border, hairlines between links, hover and current-page treatments

## How it works

Every nav link and folder is read from your header as it stands, so adding a page in Squarespace adds it to the sidebar with nothing to configure. Fonts and colours are read off your real navigation links, so the sidebar matches your theme on any 7.1 template.

Folders open on click, never on hover, and one at a time by default — opening one closes the others, which you can turn off. Each is a real `aria-expanded` button with `aria-controls`, Escape closes an open folder, the current page carries `aria-current="page"`, and visitors who ask for reduced motion get instant open/close instead of the slide.

Inside the Squarespace editor the plugin stands down so your real header stays editable.

Below the breakpoint everything is put back exactly where Squarespace rendered it — same parent, same sibling order — so the mobile header is untouched.

## Not covered

- Squarespace 7.0 templates (the header markup is different)
- More than one level of folder nesting — 7.1 does not offer it
