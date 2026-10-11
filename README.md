# Gradient Studio

A responsive Angular gradient editor for building, saving, sharing, and copying
CSS gradients.

## Requirements

- Node.js 22.12 or newer
- npm 11 or newer

## Run locally

```sh
npm install
npm start
```

Open the local URL printed by Angular CLI. Create a production build with
`npm run build`.

## Deploy to GitHub Pages

Pushing to the `master` branch builds and deploys the app to
[https://abhayvishnoi.github.io/backgroundgenerator/](https://abhayvishnoi.github.io/backgroundgenerator/).
The workflow can also be run manually from the repository's Actions tab.

## Features

- Linear and radial gradients with adjustable angle
- Two to five editable color stops, with randomized stop positions
- Ready-to-use gradient presets and one-click random generation
- Local favorites saved in the browser
- Copy the generated CSS or a shareable link
- Export a gradient preview as an SVG file
- Extract a color palette from a local image with Node Vibrant
- Light and dark themes, with the preference saved in the browser
- Branded SVG favicon, search metadata, and social-sharing metadata

Share links store the current gradient settings in the URL, so they can be
reopened without an account or a backend.

Image color extraction runs locally in your browser with the `node-vibrant`
npm package; images are not uploaded. Image files must be under 10 MB.
