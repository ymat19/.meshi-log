// Mock photos are inline SVG data URIs: no binary assets, fully offline, and
// just plain strings as far as the <img> tag is concerned. Real entries point
// at real image paths instead — the UI cannot tell the difference.

const PALETTE = ['#e8a87c', '#c38d9e', '#85b79d', '#e7c662', '#8d9db6', '#d98880']

export function mockPhoto(label: string, seed: number): string {
  const bg = PALETTE[seed % PALETTE.length]
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">` +
    `<rect width="400" height="300" fill="${bg}"/>` +
    `<text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="28" ` +
    `font-weight="bold" text-anchor="middle" dominant-baseline="middle">${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
