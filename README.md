# DemoTab

**A browser tab that displays whatever you paste — beautifully, privately, and instantly.**

Open DemoTab before a screen share or presentation. Paste text, markdown, HTML source, code, or an image. It renders cleanly for your audience with no distractions, no uploads, and no network traffic of any kind.

---

## What it does

| Mode | What gets rendered |
|---|---|
| **Auto** | Detects content type automatically |
| **Text** | Clean readable typography, paragraphs preserved |
| **Markdown** | Headers, lists, bold, italic, tables, code blocks |
| **HTML** | Syntax-highlighted source — never rendered as live HTML |
| **Code** | Syntax highlighting with line numbers, language picker |
| **Image** | Paste or drop any image — rendered locally via `URL.createObjectURL()` |

---

## Privacy guarantee

DemoTab ships with a `Content-Security-Policy: connect-src 'none'` header on every request to the main app. The browser will physically refuse any outgoing network connection — not a promise, a browser-enforced constraint you can verify yourself in DevTools → Network.

- No servers receive your content
- No analytics on the app page
- No external fonts, no CDN at runtime
- No cookies, no localStorage of pasted content
- Everything runs in your browser tab and disappears on close

---

## Tech stack

- **Vanilla JS** — zero frameworks, zero npm runtime dependencies
- **Single-file app** — `app.js` + `app.css`, no bundler
- **Custom markdown parser** — written from scratch (`parseMarkdown` / `parseInline`)
- **Custom syntax highlighter** — supports JavaScript, TypeScript, Python, Go, Rust, Java, SQL, CSS, HTML, Bash
- **VS Code Dark+** and **GitHub Light** color schemes (WCAG AA contrast tested)
- **SVG logo** — fully vectorized, text paths traced from source PNG
- **Cloudflare Pages** — static hosting, zero build step

---

## Repo structure

```
demotab.app/
├── site/                     <- Cloudflare Pages build output directory
│   ├── index.html            <- Main app
│   ├── about.html            <- Marketing / info page
│   ├── app.js                <- All app logic (~700 lines, no dependencies)
│   ├── app.css               <- All styles + CSS custom properties for theming
│   ├── logo_full.svg         <- Vectorized logo (icon + wordmark)
│   ├── favicon.ico           <- Multi-size (16/32/48px)
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png  <- 180x180
│   ├── icon-192.png          <- PWA ready
│   ├── icon-512.png
│   └── _headers              <- Cloudflare Pages HTTP headers (CSP, cache)
├── logo_icon_only.png        <- Source asset (430x430, used to generate favicons)
├── package.json
└── README.md
```

---

## Deploying to Cloudflare Pages

1. Connect the repo in the Cloudflare Pages dashboard
2. Set **Build output directory** to `site`
3. Leave **Build command** blank — there is no build step
4. Deploy

The `_headers` file is picked up automatically by Cloudflare Pages and applies per-route CSP and cache headers.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `A` | Auto mode |
| `T` | Text mode |
| `M` | Markdown mode |
| `H` | HTML mode |
| `C` | Code mode |
| `I` | Image mode |
| `+` / `=` | Increase font size |
| `-` | Decrease font size |
| `0` | Reset font size |
| `W` | Toggle line wrap (code view) |
| `D` | Toggle dark / light code theme |
| `Esc` | Clear content |

---

## Browser support

Any modern browser (Chrome, Edge, Firefox, Safari). The Clipboard API (`navigator.clipboard.readText`) requires a user gesture; on `file://` it will prompt once per session. On HTTPS it works silently.

---

## Made by

JayPee Softworks
