// One-off: convert the new landscape JPG logo into square PNG app icons.
// Pads the logo (centered) onto its own background colour so nothing is cropped.
const path = require('path');
const Jimp = require('jimp-compact');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS, 'icon.png');

async function main() {
  const src = await Jimp.read(SRC);

  // Background colour sampled from the top-left corner (the logo's backdrop).
  const bg = src.getPixelColor(0, 0);

  // Trim the uniform background border so the logo itself is as large as possible.
  try { src.autocrop({ tolerance: 0.02, cropOnlyFrames: false }); } catch {}
  const w = src.getWidth();
  const h = src.getHeight();

  // Square canvas sized so the (wide) logo fills ~84% of the width, centered,
  // with the rest padded in the logo's own background colour.
  const margin = 0.08;
  const side = Math.max(w, h, Math.round(w / (1 - 2 * margin)));

  const square = new Jimp(side, side, bg);
  square.composite(src, Math.round((side - w) / 2), Math.round((side - h) / 2));

  const icon = square.clone().resize(1024, 1024);
  await icon.writeAsync(path.join(ASSETS, 'icon.png'));
  await icon.clone().writeAsync(path.join(ASSETS, 'adaptive-icon.png'));

  const favicon = square.clone().resize(48, 48);
  await favicon.writeAsync(path.join(ASSETS, 'favicon.png'));

  console.log(`Source ${w}x${h} -> square ${side}; wrote icon.png (1024), adaptive-icon.png (1024), favicon.png (48)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
