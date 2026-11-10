# wetakush — research environment

Live: https://wetakush.github.io/

Static HTML, CSS and JavaScript. No build dependencies.

## Local preview

```sh
python3 -m http.server 4173
```

## Interactions

- Web / API / Source controls change the active node and inspector.
- Canvas nodes can also be selected with a pointer; equivalent buttons support keyboard use.
- Staggered scene assembly, eased node elevation and lighting, selection waves, moving signal packets and a scanning ground plane.
- Pointer-responsive console tilt and lighting on devices with a mouse.
- Motion control pauses animations; reduced-motion preference is respected automatically.
- Canvas animation stops when offscreen or when the page is hidden.

GitHub Pages deploys the root of `main`. Existing `/trashbio/`, `/claude/`, media, feed and verification files are retained.
