(function () {
  /*
    SDL Sidebar Nav v1.0
    Turns the Squarespace 7.1 site header into a fixed, full-height sidebar on
    desktop, and leaves the native header alone on mobile apart from turning
    folders into accordions.

    Strategy: the native <header id="header"> element IS the sidebar. Nothing is
    cloned out of it — the site title, cart, social icons, account link and
    button are *moved* into zone wrappers that stay inside `.header`, so every
    Squarespace selector (theme colours, `.btn` styles, the live cart quantity
    binding, icon borders) keeps applying exactly as it did in the top bar.

    Only the nav list is rebuilt, because the native folder dropdown is a
    hover-opened floating panel and we need a click-driven accordion. The
    original `.header-nav` is hidden rather than removed, and every moved node
    remembers its parent and next sibling, so crossing back to mobile restores
    the header exactly as Squarespace rendered it.
  */

  'use strict';

  /* ------------------------------------------------------------------ */
  /*  CONFIG                                                            */
  /* ------------------------------------------------------------------ */

  var DEFAULTS = {
    enabled: true,

    // The sidebar applies above this width. 767 is where Squarespace 7.1 swaps
    // to its own mobile header; raise it if your site switches sooner.
    breakpoint: 767,

    side: 'left',              // 'left' | 'right'
    width: 280,
    widthUnit: 'px',           // 'px' | '%'

    // Vertical band for the nav. 'top' sits directly under the logo.
    navPosition: 'top',        // 'top' | 'center' | 'bottom'

    // Vertical band for each native header element. 'hide' drops it.
    elements: {
      social:   'bottom',      // 'top' | 'center' | 'bottom' | 'hide'
      cart:     'bottom',
      account:  'bottom',
      cta:      'bottom',
      search:   'top',
      language: 'bottom',
      other:    'bottom'
    },

    // Horizontal alignment of everything in the sidebar.
    align: 'left',             // 'left' | 'center' | 'right'

    submenu: {
      icon: 'caret',           // 'caret' | 'plus' | 'arrow' | 'none'
      iconPosition: 'edge',    // 'edge' | 'inline' | 'left'
      iconSize: 13,
      // One folder open at a time. A vertical list is read top to bottom, and
      // several open folders push later links far down the column.
      singleOpen: true,
      openActive: true,        // open the folder holding the current page
      duration: 280,
      indent: 16,
      subScale: 0.92
    },

    mobile: {
      enabled: true,           // accordion folders in the native mobile menu
      icon: 'caret',
      iconPosition: 'edge',
      iconSize: 15,
      singleOpen: true,
      openActive: false,
      indent: 18,
      subScale: 0.82,
      duration: 280
    },

    styles: {
      background: '',          // '' follows the header / site background
      textColor: '',           // '' follows the header text colour
      paddingX: 32,
      paddingY: 32,
      zoneGap: 26,
      itemGap: 14,
      fontSize: 0,             // 0 inherits the site navigation font size
      logoWidth: 0,            // px; 0 leaves the logo at its natural size
      socialGap: 16,
      actionGap: 16,           // between login / cart / social in the icon row
      // Social icons get their own row: a login link, a cart and three icons
      // are a sub-pixel away from wrapping in a 280px column, and a row that
      // sometimes wraps reads as a mistake. Set true to keep them inline.
      socialInline: false,
      border: true,
      borderColor: '',         // '' derives from the text colour
      borderWidth: 1,
      dividers: false,         // hairline between top-level items
      hover: 'opacity',        // 'opacity' | 'underline' | 'none'
      active: 'bold',          // 'bold' | 'underline' | 'dot' | 'none'
      // Off keeps the button identical to the one in your header. On stretches
      // it to the column width, which changes its proportions.
      ctaFullWidth: false
    },

    // Squarespace pads the first section by the header height so a fixed top
    // bar cannot cover it. With a full-height sidebar that padding is the whole
    // viewport, so it is cleared.
    clearFirstSectionPadding: true,

    // Some 7.1 sections size themselves off 100vw; clipping stops the
    // horizontal scrollbar that would cause. `clip` keeps sticky working.
    clipOverflow: true,

    // Stand down while the Squarespace editor is in edit mode.
    skipInEditor: true
  };

  function isPlain(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function merge(base, over) {
    var out = {}, k;
    over = over || {};
    for (k in base) {
      if (!Object.prototype.hasOwnProperty.call(base, k)) continue;
      if (isPlain(base[k])) out[k] = merge(base[k], isPlain(over[k]) ? over[k] : {});
      else out[k] = over[k] === undefined ? base[k] : over[k];
    }
    for (k in over) {
      if (Object.prototype.hasOwnProperty.call(over, k) && !(k in out)) out[k] = over[k];
    }
    return out;
  }

  var cfg = merge(DEFAULTS, window.SDL_SIDEBAR_NAV_CONFIG || {});

  /* ------------------------------------------------------------------ */
  /*  ICONS                                                             */
  /* ------------------------------------------------------------------ */

  var ICONS = {
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="5 9 12 16 19 9"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="9 5 16 12 9 19"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<line x1="4" y1="12" x2="20" y2="12"/>' +
          '<line class="sdlsn-bar-v" x1="12" y1="4" x2="12" y2="20"/></svg>'
  };

  function iconEl(name) {
    if (!name || name === 'none' || !ICONS[name]) return null;
    var s = document.createElement('span');
    s.className = 'sdlsn__icon';
    s.setAttribute('data-sdlsn-icon', name);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name];
    return s;
  }

  /* ------------------------------------------------------------------ */
  /*  DOM HELPERS                                                       */
  /* ------------------------------------------------------------------ */

  function q(sel, root) {
    try { return (root || document).querySelector(sel); } catch (e) { return null; }
  }

  function qa(sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  }

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }

  function childrenOf(parent, sel) {
    return Array.prototype.filter.call(parent.children, function (c) {
      return c.matches(sel);
    });
  }

  var uid = 0;
  function nextId(p) { uid += 1; return p + uid; }

  /* Remember where a node came from so a move can be undone exactly. */
  var homes = [];

  function park(node) {
    if (!node || node.__sdlsnParked) return;
    homes.push({ node: node, parent: node.parentNode, next: node.nextSibling });
    node.__sdlsnParked = true;
  }

  function restoreAll() {
    for (var i = homes.length - 1; i >= 0; i--) {
      var h = homes[i];
      if (!h.parent) continue;
      if (h.next && h.next.parentNode === h.parent) h.parent.insertBefore(h.node, h.next);
      else h.parent.appendChild(h.node);
      h.node.__sdlsnParked = false;
    }
    homes = [];
  }

  /* Squarespace nav hrefs are root-relative; compare paths, ignore trailing / */
  function normPath(href) {
    if (!href || href.charAt(0) === '#') return null;
    var a = document.createElement('a');
    a.href = href;
    if (a.host !== location.host) return null;
    return a.pathname.replace(/\/+$/, '') || '/';
  }

  var HERE = location.pathname.replace(/\/+$/, '') || '/';

  function markCurrent(a, href) {
    var p = normPath(href);
    if (p && p === HERE) { a.setAttribute('aria-current', 'page'); return true; }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  ACCORDION                                                         */
  /* ------------------------------------------------------------------ */

  var REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function reduced() { return !!(REDUCED && REDUCED.matches); }

  function openPanel(btn, panel, animate) {
    btn.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    if (!animate || reduced()) { panel.style.height = ''; return; }
    var target = panel.scrollHeight;
    panel.style.height = '0px';
    void panel.offsetHeight;               // flush, so the transition has a start
    panel.style.height = target + 'px';
    afterTransition(panel, function () { panel.style.height = ''; });
  }

  function closePanel(btn, panel, animate) {
    btn.setAttribute('aria-expanded', 'false');
    if (!animate || reduced()) { panel.hidden = true; panel.style.height = ''; return; }
    panel.style.height = panel.scrollHeight + 'px';
    void panel.offsetHeight;
    panel.style.height = '0px';
    afterTransition(panel, function () { panel.hidden = true; panel.style.height = ''; });
  }

  function afterTransition(node, done) {
    if (node.__sdlsnEnd) node.removeEventListener('transitionend', node.__sdlsnEnd);
    clearTimeout(node.__sdlsnTimer);
    var fn = function (e) {
      if (e && e.target !== node) return;
      node.removeEventListener('transitionend', fn);
      node.__sdlsnEnd = null;
      clearTimeout(node.__sdlsnTimer);
      done();
    };
    node.__sdlsnEnd = fn;
    node.addEventListener('transitionend', fn);
    // transitionend never fires if the panel gets display:none'd mid-flight.
    node.__sdlsnTimer = setTimeout(fn, Math.max(cfg.submenu.duration, cfg.mobile.duration) + 300);
  }

  function wireToggle(btn, panel, group, singleOpen) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute('aria-expanded') === 'true') { closePanel(btn, panel, true); return; }
      if (singleOpen && group) {
        qa('[aria-expanded="true"]', group).forEach(function (other) {
          if (other === btn) return;
          var op = document.getElementById(other.getAttribute('aria-controls'));
          if (op) closePanel(other, op, true);
        });
      }
      openPanel(btn, panel, true);
    });

    var esc = function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (btn.getAttribute('aria-expanded') !== 'true') return;
      closePanel(btn, panel, true);
      btn.focus();
    };
    btn.addEventListener('keydown', esc);
    panel.addEventListener('keydown', esc);
  }

  /* ------------------------------------------------------------------ */
  /*  READ THE NATIVE HEADER                                            */
  /* ------------------------------------------------------------------ */

  function header() { return q('#header') || q('header.header'); }

  function desktopBox() {
    var h = header();
    return h ? q('.header-display-desktop', h) : null;
  }

  function readNav() {
    var box = desktopBox();
    var list = box && q('nav.header-nav-list', box);
    if (!list) {
      var h = header();
      list = h && q('nav.header-nav-list', h);
    }
    if (!list) return [];

    return childrenOf(list, '.header-nav-item').map(function (item) {
      var folderTitle = q('.header-nav-folder-title', item);
      if (folderTitle) {
        var labelNode = q('.header-nav-folder-title-text', folderTitle);
        // 7.1 renders folder titles as <button data-href>; only a real anchor
        // means the folder has a page of its own worth linking to.
        var realHref = folderTitle.tagName === 'A' ? folderTitle.getAttribute('href') : null;
        return {
          type: 'folder',
          label: (labelNode || folderTitle).textContent.trim(),
          href: realHref,
          children: qa('.header-nav-folder-item', item).map(function (fi) {
            var a = q('a', fi);
            var c = q('.header-nav-folder-item-content', fi);
            return {
              label: ((c || a || fi).textContent || '').trim(),
              href: a ? a.getAttribute('href') : null,
              target: a ? a.getAttribute('target') : null
            };
          }).filter(function (c) { return c.label; })
        };
      }
      var a = q('a', item);
      if (!a) return null;
      return {
        type: 'link',
        label: a.textContent.trim(),
        href: a.getAttribute('href'),
        target: a.getAttribute('target')
      };
    }).filter(function (n) { return n && n.label; });
  }

  /* Header action nodes bucketed by kind. The duplicates 7.1 renders inside
     `.showOnMobile` are skipped so the sidebar never gets two carts. */
  function readActions() {
    var box = desktopBox();
    var found = {};
    if (!box) return found;

    function put(kind, node) {
      if (!node || (node.closest && node.closest('.showOnMobile'))) return;
      var arr = found[kind] || (found[kind] = []);
      if (arr.indexOf(node) === -1) arr.push(node);
    }

    qa('.header-actions-action', box).forEach(function (n) {
      var c = ' ' + n.className + ' ';
      if (c.indexOf('--social') > -1) put('social', n);
      else if (c.indexOf('--cart') > -1) put('cart', n);
      else if (c.indexOf('--cta') > -1) put('cta', n);
      else if (c.indexOf('--account') > -1) put('account', n);
      else if (c.indexOf('--search') > -1) put('search', n);
      else if (c.indexOf('--language') > -1) put('language', n);
      else put('other', n);
    });

    // The customer-accounts link is not a `.header-actions-action` in 7.1.
    qa('.user-accounts-link', box).forEach(function (n) { put('account', n); });
    qa('.language-picker', box).forEach(function (n) {
      if (!n.closest('.header-actions-action')) put('language', n);
    });

    return found;
  }

  /* ------------------------------------------------------------------ */
  /*  STYLE TOKENS                                                      */
  /* ------------------------------------------------------------------ */

  function isTransparent(c) {
    c = (c || '').trim();
    if (!c || c === 'transparent' || c === 'none') return true;
    // rgba(…, 0) / hsla(…, 0) in any notation
    return /^(rgba|hsla)\([^)]*[,/]\s*0*\.?0+\s*\)$/i.test(c);
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* Resolve any CSS colour notation to rgb()/rgba() so it can be picked apart. */
  function resolveColor(v) {
    if (!v) return '';
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    probe.style.color = '';
    probe.style.color = v;
    if (!probe.style.color) return '';
    document.documentElement.appendChild(probe);
    var out = getComputedStyle(probe).color;
    probe.parentNode.removeChild(probe);
    return out;
  }

  function rgbaFrom(color, alpha) {
    var m = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!m) return 'rgba(0,0,0,' + alpha + ')';
    var p = m[1].split(',');
    return 'rgba(' + parseFloat(p[0]) + ',' + parseFloat(p[1]) + ',' + parseFloat(p[2]) + ',' + alpha + ')';
  }

  /* Read a real nav link's typography before it is hidden, so the sidebar
     matches the site's navigation font on any 7.1 template. */
  function captureTokens() {
    var box = desktopBox();
    var h = header();
    var probe = box && (
      q('.header-nav-item--collection > a', box) ||
      q('.header-nav-item > a', box) ||
      q('.header-nav-folder-title', box)
    );
    var t = {};

    if (probe) {
      var c = getComputedStyle(probe);
      t.ff = c.fontFamily;
      t.fs = c.fontSize;
      t.fw = c.fontWeight;
      t.fst = c.fontStyle;
      t.ls = c.letterSpacing;
      t.tt = c.textTransform;
      t.lh = c.lineHeight === 'normal' ? '1.35' : c.lineHeight;
    }

    /* Colour needs care. A 7.1 header can be `data-header-style="dynamic"`,
       which recolours its text to suit whichever section is passing behind it
       — cream over a dark hero, near-black over a light one. The sidebar has no
       section behind it, it sits on the page background, so inheriting that
       live colour is wrong by design and lands on cream-on-cream.
       `--solidHeader*` is exactly the pair Squarespace uses when the header is
       NOT overlaying anything, which is our situation. */
    var fg = cfg.styles.textColor ||
      cssVar('--solidHeaderNavigationColor') ||
      cssVar('--navigationLinkColor');
    if (isTransparent(fg)) fg = h ? getComputedStyle(h).color : '';
    t.fg = resolveColor(fg) || fg;

    var bg = cfg.styles.background;
    if (isTransparent(bg)) bg = cssVar('--solidHeaderBackgroundColor');
    if (isTransparent(bg)) {
      var bgNode = h && q('.header-background', h);
      bg = bgNode ? getComputedStyle(bgNode).backgroundColor : '';
    }
    if (isTransparent(bg) && h) bg = getComputedStyle(h).backgroundColor;
    if (isTransparent(bg)) bg = cssVar('--siteBackgroundColor');
    if (isTransparent(bg)) bg = getComputedStyle(document.body).backgroundColor;
    if (isTransparent(bg)) bg = '#ffffff';
    t.bg = resolveColor(bg) || bg;

    t.border = cfg.styles.borderColor || rgbaFrom(t.fg, 0.14);
    return t;
  }

  function applyVars(t) {
    var r = document.documentElement.style;
    var s = cfg.styles;

    r.setProperty('--sdlsn-w', cfg.width + (cfg.widthUnit === '%' ? '%' : 'px'));
    r.setProperty('--sdlsn-pad-x', s.paddingX + 'px');
    r.setProperty('--sdlsn-pad-y', s.paddingY + 'px');
    r.setProperty('--sdlsn-zone-gap', s.zoneGap + 'px');
    r.setProperty('--sdlsn-gap', s.itemGap + 'px');
    r.setProperty('--sdlsn-indent', cfg.submenu.indent + 'px');
    r.setProperty('--sdlsn-dur', cfg.submenu.duration + 'ms');
    r.setProperty('--sdlsn-icon-size', cfg.submenu.iconSize + 'px');
    r.setProperty('--sdlsn-sub-scale', String(cfg.submenu.subScale));
    r.setProperty('--sdlsn-social-gap', s.socialGap + 'px');
    r.setProperty('--sdlsn-action-gap', s.actionGap + 'px');
    r.setProperty('--sdlsn-border-w', s.borderWidth + 'px');
    r.setProperty('--sdlsn-border-c', t.border);
    r.setProperty('--sdlsn-bg', t.bg);
    if (t.fg) r.setProperty('--sdlsn-fg', t.fg);
    if (s.logoWidth) r.setProperty('--sdlsn-logo-w', s.logoWidth + 'px');
    else r.removeProperty('--sdlsn-logo-w');

    r.setProperty('--sdlsn-align', cfg.align);
    r.setProperty('--sdlsn-justify',
      cfg.align === 'center' ? 'center' : cfg.align === 'right' ? 'flex-end' : 'flex-start');
    r.setProperty('--sdlsn-items',
      cfg.align === 'center' ? 'center' : cfg.align === 'right' ? 'flex-end' : 'flex-start');

    if (t.ff) {
      r.setProperty('--sdlsn-nav-ff', t.ff);
      r.setProperty('--sdlsn-nav-fs', s.fontSize ? s.fontSize + 'px' : t.fs);
      r.setProperty('--sdlsn-nav-fw', t.fw);
      r.setProperty('--sdlsn-nav-fst', t.fst);
      r.setProperty('--sdlsn-nav-ls', t.ls);
      r.setProperty('--sdlsn-nav-tt', t.tt);
      r.setProperty('--sdlsn-nav-lh', t.lh);
    } else if (s.fontSize) {
      r.setProperty('--sdlsn-nav-fs', s.fontSize + 'px');
    }

    var m = cfg.mobile;
    r.setProperty('--sdlsn-m-indent', m.indent + 'px');
    r.setProperty('--sdlsn-m-subsize', m.subScale + 'em');
    r.setProperty('--sdlsn-m-icon-size', m.iconSize + 'px');
  }

  function applyFlags() {
    var c = document.documentElement.classList;
    var s = cfg.styles;
    c.toggle('sdlsn-side-right', cfg.side === 'right');
    c.toggle('sdlsn-border', !!s.border);
    c.toggle('sdlsn-clip', !!cfg.clipOverflow);
    c.toggle('sdlsn-dividers', !!s.dividers);
    c.toggle('sdlsn-cta-full', !!s.ctaFullWidth);
    ['opacity', 'underline', 'none'].forEach(function (h) {
      c.toggle('sdlsn-hover-' + h, s.hover === h);
    });
    ['bold', 'underline', 'dot', 'none'].forEach(function (a) {
      c.toggle('sdlsn-active-' + a, s.active === a);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  BUILD THE SIDEBAR                                                 */
  /* ------------------------------------------------------------------ */

  var shell = null;

  function buildNav(model) {
    if (!model.length) return null;

    var nav = el('nav', 'sdlsn__nav', { 'aria-label': 'Main' });
    var list = el('ul', 'sdlsn__list');
    nav.appendChild(list);

    model.forEach(function (item) {
      var li = el('li', 'sdlsn__item');

      if (item.type === 'link') {
        var a = el('a', 'sdlsn__link', { href: item.href, target: item.target });
        var lbl = el('span', 'sdlsn__label');
        lbl.textContent = item.label;
        a.appendChild(lbl);
        markCurrent(a, item.href);
        li.appendChild(a);
        list.appendChild(li);
        return;
      }

      li.className = 'sdlsn__item sdlsn__item--folder';
      var pid = nextId('sdlsn-panel-');
      var icon = iconEl(cfg.submenu.icon);
      var toggle, row;

      if (item.href) {
        // The folder has its own page: keep the label a link and give the
        // disclosure its own control, so both actions stay reachable.
        row = el('div', 'sdlsn__link sdlsn__link--folder sdlsn__link--split');
        var link = el('a', 'sdlsn__folderlink', { href: item.href });
        var flbl = el('span', 'sdlsn__label');
        flbl.textContent = item.label;
        link.appendChild(flbl);
        markCurrent(link, item.href);
        toggle = el('button', 'sdlsn__disclosure', {
          type: 'button', 'aria-expanded': 'false', 'aria-controls': pid,
          'aria-label': item.label + ' submenu'
        });
        if (icon) toggle.appendChild(icon);
        row.appendChild(link);
        row.appendChild(toggle);
        li.appendChild(row);
      } else {
        toggle = el('button', 'sdlsn__link sdlsn__link--folder', {
          type: 'button', 'aria-expanded': 'false', 'aria-controls': pid
        });
        var blbl = el('span', 'sdlsn__label');
        blbl.textContent = item.label;
        toggle.appendChild(blbl);
        if (icon) toggle.appendChild(icon);
        li.appendChild(toggle);
      }

      var panel = el('div', 'sdlsn__panel', { id: pid });
      panel.hidden = true;
      var sub = el('ul', 'sdlsn__sub');
      var hasCurrent = false;

      item.children.forEach(function (child) {
        var cli = el('li', 'sdlsn__subitem');
        var ca = el('a', 'sdlsn__sublink', { href: child.href, target: child.target });
        ca.textContent = child.label;
        if (markCurrent(ca, child.href)) hasCurrent = true;
        cli.appendChild(ca);
        sub.appendChild(cli);
      });

      panel.appendChild(sub);
      li.appendChild(panel);
      list.appendChild(li);

      wireToggle(toggle, panel, list, cfg.submenu.singleOpen);
      if (hasCurrent && cfg.submenu.openActive) openPanel(toggle, panel, false);
    });

    return nav;
  }

  /* Render order inside a band: brand, nav, the icon row, then the button.
     The button is the heaviest element in the column, so it reads as the end
     of the block — putting it above the icons leaves them looking orphaned. */
  var ACTION_ORDER = ['search', 'account', 'cart', 'social', 'language', 'other', 'cta'];

  function mount() {
    var h = header();
    var box = desktopBox();
    if (!h || !box || shell) return;

    var t = captureTokens();          // must run before the nav is hidden
    applyVars(t);
    applyFlags();

    // An announcement bar cannot live inside a 280px column.
    var bar = childrenOf(h, '.sqs-announcement-bar-dropzone')[0];
    if (bar && bar.offsetHeight > 0) {
      park(bar);
      bar.classList.add('sdlsn-annbar');
      document.body.insertBefore(bar, document.body.firstChild);
      document.documentElement.style.setProperty('--sdlsn-top', bar.offsetHeight + 'px');
    } else {
      bar = null;
    }

    var wrapper = q('#siteWrapper') || q('.site-wrapper') || (q('#page') && q('#page').parentNode);
    if (wrapper) wrapper.classList.add('sdlsn-wrapper');

    if (cfg.clearFirstSectionPadding) {
      var page = q('#page') || q('main');
      var first = page && (q('.page-section', page) || q('.sections > *', page));
      if (first) first.classList.add('sdlsn-first-section');
    }

    shell = el('div', 'sdlsn', {
      'data-align': cfg.align,
      'data-iconpos': cfg.submenu.iconPosition
    });
    var zones = {
      top: el('div', 'sdlsn__zone sdlsn__zone--top'),
      center: el('div', 'sdlsn__zone sdlsn__zone--mid'),
      bottom: el('div', 'sdlsn__zone sdlsn__zone--bottom')
    };
    shell.appendChild(zones.top);
    shell.appendChild(zones.center);
    shell.appendChild(zones.bottom);

    function zone(name) { return zones[name] || zones.bottom; }

    // The brand always leads the top band — it anchors the column.
    var title = q('.header-title', box);
    if (title) {
      var brand = el('div', 'sdlsn__brand');
      park(title);
      brand.appendChild(title);
      zones.top.appendChild(brand);
    }

    var nav = buildNav(readNav());
    if (nav) zone(cfg.navPosition).appendChild(nav);

    // Icons of the same band share one row so they align on a single baseline.
    var actions = readActions();
    var rows = {};

    ACTION_ORDER.forEach(function (kind) {
      var nodes = actions[kind];
      if (!nodes || !nodes.length) return;
      var where = cfg.elements[kind] || 'bottom';

      if (where === 'hide') {
        nodes.forEach(function (n) { park(n); n.remove(); });
        return;
      }

      var z = zone(where);

      if (kind === 'cta') {
        nodes.forEach(function (n) {
          var slot = el('div', 'sdlsn__slot sdlsn__slot--cta');
          park(n);
          slot.appendChild(n);
          z.appendChild(slot);
        });
        return;
      }

      var ownRow = kind === 'social' && !cfg.styles.socialInline;
      var rowKey = ownRow ? where + ':social' : where;
      if (!rows[rowKey]) {
        rows[rowKey] = el('div', 'sdlsn__actions' + (ownRow ? ' sdlsn__actions--social' : ''));
        z.appendChild(rows[rowKey]);
      }
      nodes.forEach(function (n) {
        var slot = el('div', 'sdlsn__slot sdlsn__slot--' + kind);
        park(n);
        slot.appendChild(n);
        rows[rowKey].appendChild(slot);
      });
    });

    box.appendChild(shell);
    document.documentElement.classList.add('sdlsn-on');

    if (bar && window.ResizeObserver) {
      shell.__ro = new ResizeObserver(function () {
        document.documentElement.style.setProperty('--sdlsn-top', bar.offsetHeight + 'px');
      });
      shell.__ro.observe(bar);
    }
  }

  function unmount() {
    if (!shell) return;
    if (shell.__ro) { shell.__ro.disconnect(); shell.__ro = null; }
    document.documentElement.classList.remove('sdlsn-on');
    restoreAll();
    if (shell.parentNode) shell.parentNode.removeChild(shell);
    shell = null;
    var wrapper = q('.sdlsn-wrapper');
    if (wrapper) wrapper.classList.remove('sdlsn-wrapper');
    var first = q('.sdlsn-first-section');
    if (first) {
      first.classList.remove('sdlsn-first-section');
      // Squarespace measured the header while it was a full-height column and
      // left that on the section as an inline style. It only re-measures on its
      // own resize, so put the real header height back now rather than leave a
      // viewport-tall gap behind.
      var h = header();
      if (first.style.paddingTop && h) first.style.paddingTop = h.offsetHeight + 'px';
    }
    document.documentElement.style.setProperty('--sdlsn-top', '0px');
  }

  /* ------------------------------------------------------------------ */
  /*  MOBILE — accordion folders in the native overlay menu              */
  /* ------------------------------------------------------------------ */

  var mobileBuilt = false;

  function cssEsc(v) {
    if (window.CSS && CSS.escape) return CSS.escape(v);
    return String(v).replace(/(["\\\]\[])/g, '\\$1');
  }

  function buildMobile() {
    if (mobileBuilt || !cfg.mobile.enabled) return;
    var h = header();
    var menu = h && q('.header-menu', h);
    var root = menu && q('.header-menu-nav-folder[data-folder="root"]', menu);
    var wrap = root && q('.header-menu-nav-wrapper', root);
    if (!wrap) return;

    var folders = qa('.header-menu-nav-item', wrap).filter(function (item) {
      return !!q('a[data-folder-id]', item);
    });
    if (!folders.length) return;

    var m = cfg.mobile;
    var built = 0;

    folders.forEach(function (item) {
      var a = q('a[data-folder-id]', item);
      var fid = a.getAttribute('data-folder-id');
      var source = q('.header-menu-nav-folder[data-folder="' + cssEsc(fid) + '"]', menu);
      if (!source) return;

      var kids = qa('.header-menu-nav-item', source).filter(function (k) {
        return !k.classList.contains('header-menu-controls') &&
               !q('.header-menu-controls-control', k);
      });
      if (!kids.length) return;

      var content = q('.header-menu-nav-item-content', a);
      var labelNode = q('.header-nav-folder-title-text', a);
      var label = (labelNode || content || a).textContent.trim();

      var pid = nextId('sdlsn-mpanel-');
      var btn = el('button', 'sdlsn-m-toggle', {
        type: 'button', 'aria-expanded': 'false', 'aria-controls': pid
      });
      var inner = el('div', content
        ? content.className.replace(/header-menu-nav-item-content-folder/g, '').trim()
        : 'header-menu-nav-item-content');
      inner.textContent = label;
      btn.appendChild(inner);
      var ic = iconEl(m.icon);
      if (ic) btn.appendChild(ic);

      item.classList.add('sdlsn-m-folder');
      item.setAttribute('data-iconpos', m.iconPosition);
      item.__sdlsnOrig = a;
      // Replacing the anchor takes Squarespace's drill-down handler with it.
      a.parentNode.replaceChild(btn, a);

      var panel = el('div', 'sdlsn-m-panel', { id: pid });
      panel.hidden = true;
      var pinner = el('div', 'sdlsn-m-panel-inner');
      var hasCurrent = false;

      kids.forEach(function (k) {
        var clone = k.cloneNode(true);
        clone.classList.add('sdlsn-m-subitem');
        var ka = q('a', clone);
        if (ka && markCurrent(ka, ka.getAttribute('href'))) hasCurrent = true;
        pinner.appendChild(clone);
      });

      panel.appendChild(pinner);
      if (item.nextSibling) item.parentNode.insertBefore(panel, item.nextSibling);
      else item.parentNode.appendChild(panel);

      wireToggle(btn, panel, wrap, m.singleOpen);
      if (hasCurrent && m.openActive) openPanel(btn, panel, false);
      built += 1;
    });

    if (!built) return;
    document.documentElement.classList.add('sdlsn-m-on');
    mobileBuilt = true;
  }

  function teardownMobile() {
    if (!mobileBuilt) return;
    qa('.sdlsn-m-panel').forEach(function (p) {
      if (p.parentNode) p.parentNode.removeChild(p);
    });
    qa('.sdlsn-m-folder').forEach(function (item) {
      var btn = q('.sdlsn-m-toggle', item);
      if (btn && item.__sdlsnOrig) btn.parentNode.replaceChild(item.__sdlsnOrig, btn);
      item.classList.remove('sdlsn-m-folder');
      item.removeAttribute('data-iconpos');
    });
    document.documentElement.classList.remove('sdlsn-m-on');
    mobileBuilt = false;
  }

  /* ------------------------------------------------------------------ */
  /*  BREAKPOINT                                                        */
  /* ------------------------------------------------------------------ */

  function wantsSidebar() {
    return cfg.enabled && window.innerWidth > cfg.breakpoint;
  }

  function sync() {
    if (wantsSidebar()) {
      teardownMobile();
      mount();
    } else {
      unmount();
      buildMobile();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  BOOT                                                              */
  /* ------------------------------------------------------------------ */

  /* True while the site is being edited in Squarespace, so the plugin can stand
     down and leave the real header editable.

     Two independent signals, because neither alone is reliable:
       1. Edit-mode classes — definitive, but only once editing actually starts.
       2. Being framed by squarespace.com — the editor renders the site in an
          iframe on the /config URL. `ancestorOrigins` reports the parent origin
          even cross-origin; `document.referrer` is the fallback for browsers
          that do not implement it. */
  function framedBySquarespace() {
    if (window.self === window.top) return false;
    var host = /(^|\.)squarespace\.com$/;
    try {
      var ao = location.ancestorOrigins;
      if (ao && ao.length) {
        for (var i = 0; i < ao.length; i++) {
          if (host.test(new URL(ao[i]).hostname)) return true;
        }
        return false;
      }
    } catch (e) { /* fall through to the referrer */ }
    try {
      return !!document.referrer && host.test(new URL(document.referrer).hostname);
    } catch (e) { return false; }
  }

  function editing() {
    var d = document.documentElement, b = document.body;
    if (d.classList.contains('sqs-edit-mode') || d.classList.contains('sqs-edit-mode-active')) return true;
    if (b && (b.classList.contains('sqs-edit-mode-active') || b.classList.contains('sqs-edit-mode'))) return true;
    if (q('.sqs-editing-overlay') || q('.sqs-block-editor-overlay') || q('#sqs-cmp-loader')) return true;
    return framedBySquarespace();
  }

  function start() {
    if (!cfg.enabled) return;
    if (cfg.skipInEditor && editing()) return;
    if (!header()) return;

    // If the site is already showing its own mobile header at a width above the
    // configured breakpoint, the site wins — a long nav can force 7.1 to switch
    // early, and a sidebar over a mobile header would double up.
    var mob = q('.header-display-mobile');
    if (mob && window.innerWidth > cfg.breakpoint &&
        getComputedStyle(mob).display !== 'none') {
      cfg.breakpoint = window.innerWidth;
    }

    sync();

    var raf = null;
    window.addEventListener('resize', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; sync(); });
    });

    // Edit mode can be entered and left without a reload, so track it both ways.
    if (cfg.skipInEditor && window.MutationObserver) {
      var wasEditing = false;
      var watch = new MutationObserver(function () {
        var now = editing();
        if (now === wasEditing) return;
        wasEditing = now;
        if (now) { unmount(); teardownMobile(); }
        else sync();
      });
      watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    // 7.1 finishes hydrating the header after first paint (cart quantity, social
    // icons, customer accounts). Re-check for a while so late nodes get placed.
    var tries = 0;
    var tick = setInterval(function () {
      tries += 1;
      if (shell && !shell.isConnected) { shell = null; sync(); }
      else if (!shell && wantsSidebar()) sync();
      else if (!shell && !mobileBuilt) buildMobile();
      if (tries > 12) clearInterval(tick);
    }, 400);

    window.SDL_SIDEBAR_NAV = {
      config: cfg,
      refresh: function () { unmount(); teardownMobile(); sync(); },
      destroy: function () { unmount(); teardownMobile(); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
