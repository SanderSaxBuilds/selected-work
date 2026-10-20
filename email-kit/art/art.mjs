// Draws the sample illustrations as SVG and renders them to PNG for the emails.
// Everything is flat vector art made for this kit. No photos, no stock.
// Usage: node art/art.mjs     writes art/*.svg and images/*.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from '../checks/cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'images');
mkdirSync(out, { recursive: true });

const C = { cherry: '#a3213a', cherryDark: '#861a30', cherryDeep: '#6f1427', cream: '#fbefe6', roast: '#2a1b17', roastMid: '#5a2e26', roastBean: '#3a1d16', kraft: '#c99d72', kraftDark: '#b4875c', kraftShade: '#b98c61', kraftLight: '#d4aa80', serration: '#a57a51', tile: '#efe2d1' };

const bean = (x, y, rot, s, fill, line) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse rx="17" ry="24" fill="${fill}"/><path d="M1.5 -21 C -9 -8, 9 8, -1.5 21" fill="none" stroke="${line}" stroke-width="4" stroke-linecap="round"/></g>`;

const cherryFruit = (x, y, r = 16) =>
  `<g><circle cx="${x}" cy="${y}" r="${r}" fill="#c8344f"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#e2687c"/><path d="M${x} ${y - r} q 4 -10 12 -12" fill="none" stroke="#5a2e26" stroke-width="3" stroke-linecap="round"/></g>`;

const serrations = (x0, x1, y, h) => {
  let s = '';
  for (let x = x0 + 6; x < x1 - 4; x += 8) s += `<rect x="${x}" y="${y}" width="3" height="${h}" fill="${C.serration}"/>`;
  return s;
};

function badge() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
<rect width="88" height="88" rx="18" fill="${C.cherry}"/>
${bean(44, 44, -32, 1.12, C.cream, C.cherry)}
</svg>`;
}

function bag(label, size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" rx="24" fill="${C.tile}"/>
<ellipse cx="256" cy="458" rx="164" ry="16" fill="#e0cdb6"/>
<path d="M146 132 H366 L380 436 Q381 452 365 452 H147 Q131 452 132 436 Z" fill="${C.kraft}"/>
<path d="M146 132 H184 L178 452 H147 Q131 452 132 436 Z" fill="${C.kraftShade}"/>
<path d="M330 132 H366 L380 436 Q381 452 365 452 H336 Z" fill="${C.kraftLight}"/>
<rect x="140" y="94" width="232" height="48" rx="6" fill="${C.kraftDark}"/>
${serrations(140, 372, 100, 36)}
<circle cx="324" cy="178" r="11" fill="${C.kraftDark}"/><circle cx="324" cy="178" r="4" fill="#94683f"/>
<rect x="194" y="210" width="124" height="200" rx="4" fill="${label}"/>
${bean(256, 262, -30, 1.15, C.cream, label)}
<rect x="218" y="314" width="76" height="10" rx="5" fill="${C.cream}"/>
<rect x="230" y="334" width="52" height="8" rx="4" fill="${C.cream}" opacity="0.7"/>
<rect x="216" y="364" width="80" height="24" rx="2" fill="none" stroke="${C.cream}" stroke-width="3" opacity="0.85"/>
</svg>`;
}

function filters(size = 512) {
  const cone = (dx, dy, rot) => `<g transform="translate(${dx} ${dy}) rotate(${rot} 256 290)">
<path d="M186 404 L122 182 Q256 120 390 182 L326 404 Z" fill="#fbf7f0" stroke="#d6c2a8" stroke-width="3" stroke-linejoin="round"/>
<path d="M192 384 L320 384" stroke="#e3d3bd" stroke-width="3" stroke-dasharray="6 6"/>
<path d="M144 196 L200 392" stroke="#e3d3bd" stroke-width="3" stroke-dasharray="6 6"/>
</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" rx="24" fill="${C.tile}"/>
<ellipse cx="256" cy="440" rx="150" ry="14" fill="#e0cdb6"/>
${cone(28, -26, 8)}
${cone(0, 0, 0)}
${cone(-26, 24, -8)}
</svg>`;
}

function welcomeHero() {
  const beans = [
    [520, 92, 20, '#8a5038'], [566, 150, -40, '#6b3a2c'], [610, 64, 70, '#8a5038'], [1000, 70, 60, '#6b3a2c'],
    [1060, 132, 10, '#8a5038'], [1120, 300, -20, '#6b3a2c'], [1030, 420, 45, '#8a5038'], [560, 420, -60, '#8a5038'],
    [500, 352, 30, '#6b3a2c'], [110, 420, 15, '#8a5038'], [76, 96, -30, '#6b3a2c'], [170, 452, 70, '#6b3a2c'],
    [1150, 196, 80, '#8a5038'], [940, 446, -50, '#6b3a2c'], [478, 216, 25, '#8a5038'], [62, 300, 50, '#8a5038']
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480">
<rect width="1200" height="480" fill="#3a221c"/>
<g transform="translate(290 244) rotate(-9)">
<rect x="-118" y="-176" width="236" height="344" rx="10" fill="${C.kraft}"/>
<rect x="-118" y="-176" width="34" height="344" rx="10" fill="${C.kraftShade}"/>
<rect x="-122" y="-182" width="244" height="46" rx="6" fill="${C.kraftDark}"/>
${serrations(-122, 122, -176, 34)}
<rect x="-74" y="-86" width="148" height="206" rx="4" fill="${C.cherry}"/>
${bean(0, -30, -30, 1.3, C.cream, C.cherry)}
<rect x="-46" y="26" width="92" height="12" rx="6" fill="${C.cream}"/>
<rect x="-32" y="50" width="64" height="9" rx="4.5" fill="${C.cream}" opacity="0.7"/>
<rect x="-50" y="80" width="100" height="26" rx="2" fill="none" stroke="${C.cream}" stroke-width="3" opacity="0.85"/>
</g>
<circle cx="790" cy="240" r="180" fill="#efdccd"/>
<circle cx="790" cy="240" r="150" fill="none" stroke="#e2c8b5" stroke-width="4"/>
<g transform="translate(790 240) rotate(38)"><rect x="104" y="-24" width="96" height="48" rx="24" fill="#fffaf4"/><rect x="134" y="-10" width="46" height="20" rx="10" fill="#efdccd"/></g>
<circle cx="790" cy="240" r="122" fill="#fffaf4"/>
<circle cx="790" cy="240" r="106" fill="#f1e4d8"/>
<circle cx="790" cy="240" r="96" fill="${C.roastMid}"/>
<circle cx="790" cy="240" r="89" fill="none" stroke="#8f5236" stroke-width="14"/>
<path d="M790 286 C 734 246, 752 196, 790 222 C 828 196, 846 246, 790 286 Z" fill="#e9cdb4"/>
<g transform="translate(652 372) rotate(-42)"><ellipse rx="17" ry="25" fill="#d8c2b0"/><rect x="-5" y="20" width="10" height="104" rx="5" fill="#d8c2b0"/></g>
${beans.map(([x, y, r, f]) => bean(x, y, r, 0.78, f, '#3a221c')).join('')}
${cherryFruit(980, 380)}${cherryFruit(1006, 398, 13)}${cherryFruit(600, 300, 14)}${cherryFruit(130, 160)}${cherryFruit(1140, 420, 13)}
</svg>`;
}

function newsletterHero() {
  const counterBeans = [[812, 482, 20], [850, 500, -50], [1100, 486, 70], [1140, 506, 10], [168, 496, -20], [132, 478, 40], [470, 506, 80], [980, 512, -30]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560">
<defs><clipPath id="glass"><path d="M580 300 L580 330 C 520 352, 500 380, 500 410 L500 432 Q500 448 516 448 L764 448 Q780 448 780 432 L780 410 C 780 380, 760 352, 700 330 L700 300 Z"/></clipPath></defs>
<rect width="1200" height="560" fill="${C.cherry}"/>
<rect y="448" width="1200" height="112" fill="${C.cherryDark}"/>
<rect y="448" width="1200" height="8" fill="${C.cherryDeep}"/>
<path d="M686 168 c -14 -18, 14 -30, 0 -50 s 14 -30, 0 -48" fill="none" stroke="#f3b7c0" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
<path d="M718 160 c -14 -18, 14 -30, 0 -50" fill="none" stroke="#f3b7c0" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
<path d="M580 300 L580 330 C 520 352, 500 380, 500 410 L500 432 Q500 448 516 448 L764 448 Q780 448 780 432 L780 410 C 780 380, 760 352, 700 330 L700 300 Z" fill="#f2d6d0"/>
<rect x="490" y="386" width="300" height="70" fill="${C.roastBean}" clip-path="url(#glass)"/>
<rect x="520" y="398" width="9" height="40" rx="4.5" fill="#fbefe6" opacity="0.45"/>
<rect x="572" y="320" width="136" height="32" rx="8" fill="${C.roastMid}"/>
<rect x="628" y="316" width="24" height="40" rx="4" fill="#7a4334"/>
<rect x="582" y="290" width="116" height="14" rx="4" fill="#ead2c6"/>
<path d="M540 194 L740 194 L690 296 L590 296 Z" fill="${C.cream}"/>
<rect x="526" y="180" width="228" height="18" rx="9" fill="${C.cream}"/>
<path d="M596 206 L622 288 M640 206 L640 288 M684 206 L658 288" stroke="#ecd2c7" stroke-width="5" stroke-linecap="round"/>
<path d="M262 330 C 190 330, 192 436, 262 424" fill="none" stroke="${C.roast}" stroke-width="18" stroke-linecap="round"/>
<path d="M440 418 C 520 410, 500 300, 522 232 C 530 206, 550 182, 578 174" fill="none" stroke="${C.roast}" stroke-width="16" stroke-linecap="round"/>
<path d="M586 178 Q 602 190 606 214" fill="none" stroke="#f6e3dc" stroke-width="5" stroke-linecap="round"/>
<rect x="248" y="300" width="204" height="148" rx="34" fill="${C.roast}"/>
<rect x="290" y="282" width="120" height="24" rx="10" fill="${C.roast}"/>
<circle cx="350" cy="272" r="12" fill="${C.roast}"/>
<rect x="272" y="318" width="14" height="100" rx="7" fill="#4a2f28"/>
<g transform="translate(940 0)">
<path d="M-80 250 H80 L90 434 Q91 448 77 448 H-77 Q-91 448 -90 434 Z" fill="${C.cream}"/>
<path d="M-80 250 H-52 L-56 448 H-77 Q-91 448 -90 434 Z" fill="#efd9cc"/>
<rect x="-84" y="222" width="168" height="38" rx="5" fill="#e7cdbf"/>
<rect x="-50" y="300" width="100" height="120" rx="3" fill="${C.roast}"/>
${bean(0, 338, -30, 0.95, C.cherry, C.roast)}
<rect x="-30" y="380" width="60" height="8" rx="4" fill="${C.cream}"/>
<rect x="-20" y="396" width="40" height="6" rx="3" fill="${C.cream}" opacity="0.7"/>
</g>
<g transform="translate(1092 0)">
<path d="M-40 384 H40 L36 436 Q35 448 23 448 H-23 Q-35 448 -36 436 Z" fill="${C.cream}"/>
<path d="M40 398 C 66 398, 66 432, 37 430" fill="none" stroke="${C.cream}" stroke-width="9"/>
<ellipse cx="0" cy="386" rx="40" ry="7" fill="${C.roastMid}"/>
</g>
${counterBeans.map(([x, y, r]) => bean(x, y, r, 0.62, C.roastBean, C.cherryDark)).join('')}
</svg>`;
}

const pieces = [
  ['logo-badge', badge(), 88, 88],
  ['welcome-hero', welcomeHero(), 1200, 480],
  ['newsletter-hero', newsletterHero(), 1200, 560],
  ['ridgeline', bag(C.cherry, 480), 480, 480],
  ['kenya-nyeri', bag('#5b2a4e', 480), 480, 480],
  ['guatemala', bag('#7a4a2a', 480), 480, 480],
  ['colombia-decaf', bag('#34465c', 480), 480, 480],
  ['thumb-ridgeline', bag(C.cherry, 112), 112, 112],
  ['thumb-ethiopia-guji', bag('#2f5d8a', 112), 112, 112],
  ['thumb-filters', filters(112), 112, 112]
];

const page = await launch({ width: 1200, height: 600 });
try {
  await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const [name, svg, w, h] of pieces) {
    const file = join(here, name + '.svg');
    writeFileSync(file, svg + '\n');
    await page.size(w, h);
    await page.goto(pathToFileURL(file).href, 'document.readyState === "complete"');
    await sleep(100);
    writeFileSync(join(out, name + '.png'), await page.screenshot({ x: 0, y: 0, width: w, height: h }));
    console.log('images/' + name + '.png', w + 'x' + h);
  }
  if (page.problems.length) console.log('problems', page.problems);
} finally {
  await page.close();
}
