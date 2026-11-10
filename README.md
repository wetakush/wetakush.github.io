# wetakush — personal archive

Personal portfolio for security research and software development.

Live: https://wetakush.github.io/

## Development

Static HTML, CSS and JavaScript; no build or dependencies required.

```sh
python3 -m http.server 4173
```

Open http://localhost:4173. The homepage is `index.html`, with `style.css` and `script.js`.

## Features

- Responsive typography and dark / lime visual identity
- Interactive canvas sphere with pointer rotation
- Native expandable expertise sections
- Portfolio terminal: Ctrl/Cmd + K; `help`, `whoami`, `skills`, `contact`, `research`, `clear`, `exit`
- Contact copy button with fallback
- Keyboard navigation, modal focus handling, reduced-motion support
- Animation pauses outside the viewport and in background tabs

The existing `/trashbio/`, `/claude/`, feed, verification files and media are retained.

## Deployment

GitHub Pages publishes the root of `main`. Push the reviewed static files to deploy.
