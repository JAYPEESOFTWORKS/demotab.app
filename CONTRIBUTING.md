# Contributing to DemoTab

Thanks for your interest. DemoTab is intentionally minimal — no build step, no bundler, no runtime dependencies. Contributions that stay true to that constraint are very welcome.

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser. That's it — no compilation needed.

## Linting

```bash
npm run lint
```

ESLint is configured in `.eslintrc.json`. Fix any errors before submitting a PR; warnings are advisory.

## Submitting a pull request

1. Fork the repo and create a branch from `main`.
2. Make your changes inside `site/` (or repo-root files like `_headers`, `README.md`).
3. Test manually in at least Chrome and Firefox — paste text, markdown, code, and an image.
4. Verify that no new outgoing network requests are introduced. The CSP (`connect-src 'none'`) must remain intact and unweakened.
5. Open a PR with a clear description of what changed and why.

## Design constraints

- **No external dependencies at runtime.** No CDN fonts, no analytics, no third-party scripts.
- **No build step.** `site/` is deployed as-is. Keep it that way.
- **CSP must not be weakened.** `connect-src 'none'` is the core privacy guarantee.
- **`app.js` is a single file.** If a change grows it significantly, discuss first.

## Reporting bugs

Open a GitHub issue. Include browser/OS version and steps to reproduce.
