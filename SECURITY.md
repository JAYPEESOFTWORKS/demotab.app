# Security Policy

## Scope

DemoTab is a static, client-side-only application with no backend, no servers, and no user accounts. The attack surface is limited to the browser-side rendering of pasted content.

Areas in scope:

- XSS or code execution via the markdown parser, syntax highlighter, or text renderer
- CSP bypass or weakening
- Clipboard API misuse
- `URL.createObjectURL` / image handling issues

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email: **admin@jaypeesoftworks.com**

Include:

- A description of the issue and its potential impact
- Steps to reproduce or a proof-of-concept
- Browser and OS version

We'll acknowledge within 48 hours and aim to ship a fix within 7 days for confirmed issues.
