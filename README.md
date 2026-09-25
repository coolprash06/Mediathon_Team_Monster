# Rush Hour — Team Monster

Mediathon 3.0 portfolio website for BPDC on the theme **Rush Hour**.

**Live site:** [SiteUrl](https://coolprash06.github.io/Mediathon_Team_Monster/)

**Youtube Video Demo (In Case there are glitches in your PC):** https://youtu.be/ur4rpfRrtGA

## The site

You enter a dark, retro security room. Pull the chain on the desk lamp to turn the lights on. Then explore:

- **Three CRT desktops**: Morning Rush, Afternoon Rush and Peak Rush. Each one plays a slideshow of the photos from that part of the day.
- **Two filing cabinets**: Canteen, Outdoor, Mini Mart, Student Lounge, Corridors and Sports Complex. Open a drawer, take the file out, and flip through the photos from that location.

Every photograph on the site was taken by the team during the competition window.

## How it's built

- **100% vanilla HTML, CSS and JavaScript.**
- **No libraries or frameworks.** No React, Three.js, jQuery, Bootstrap or anything similar.
- **No build step.** There is no `package.json`, bundler or `node_modules`. To run the site locally, open `index.html` in a browser.
- **No external requests.** All scripts, styles, fonts, textures and photos are in this repository, so the site works fully offline.
- **The 3D room is pure CSS.** It is made with CSS 3D transforms (`perspective`, `translateZ`, `rotateX/Y`) and transitions. There is no WebGL or canvas.

## Project structure

```
index.html          entry point
css/                room, views and boot-screen styles
js/                 scene construction, lamp, navigation, photo manifest
assets/photos/      the team's Rush Hour photographs
assets/textures/    CC0 surface textures (see assets/textures/CREDITS.txt)
```
