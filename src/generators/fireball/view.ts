export interface FireballView {
  width: number
  height: number
  scale: number
  cos: number
  sin: number
}

export const REFERENCE_VIEW: FireballView = { width: 128, height: 128, scale: 1, cos: 1, sin: 0 }

export function toReference(view: FireballView, px: number, py: number) {
  const dx = px - view.width / 2, dy = py - view.height / 2
  return {
    x: 64 + (dx * view.cos + dy * view.sin) / view.scale,
    y: 64 + (-dx * view.sin + dy * view.cos) / view.scale,
  }
}

export function toTarget(view: FireballView, x: number, y: number) {
  const dx = x - 64, dy = y - 64
  return {
    x: view.width / 2 + (dx * view.cos - dy * view.sin) * view.scale,
    y: view.height / 2 + (dx * view.sin + dy * view.cos) * view.scale,
  }
}

export function targetBounds(view: FireballView, minX: number, minY: number, maxX: number, maxY: number) {
  const corners = [
    toTarget(view, minX, minY), toTarget(view, maxX - 1, minY),
    toTarget(view, minX, maxY - 1), toTarget(view, maxX - 1, maxY - 1),
  ]
  return {
    minX: Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)))),
    minY: Math.max(0, Math.floor(Math.min(...corners.map(p => p.y)))),
    maxX: Math.min(view.width, Math.ceil(Math.max(...corners.map(p => p.x))) + 1),
    maxY: Math.min(view.height, Math.ceil(Math.max(...corners.map(p => p.y))) + 1),
  }
}
