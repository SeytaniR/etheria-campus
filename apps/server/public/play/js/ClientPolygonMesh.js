/**
 * @file apps/server/public/play/js/ClientPolygonMesh.js
 * @module @etheria/server
 * @description Malha Poligonal de Colisão e Sobreposição 2.5D com Pre-Culling AABB + Ray-Casting.
 */

class ClientPolygonMesh {
  constructor(collisionPolygons = [], overlapPolygons = [], overlapOpacity = 0.45) {
    this.collisionPolygons = this.compileBounds(collisionPolygons);
    this.overlapPolygons = this.compileBounds(overlapPolygons);
    this.overlapOpacity = Math.max(0.1, Math.min(1.0, Number(overlapOpacity) || 0.45));
  }

  compileBounds(polygons) {
    if (!Array.isArray(polygons)) return [];
    const compiled = [];
    for (const poly of polygons) {
      const pts = poly?.points;
      if (!Array.isArray(pts) || pts.length < 3) continue;
      let minX = pts[0].x;
      let maxX = pts[0].x;
      let minY = pts[0].y;
      let maxY = pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      compiled.push({
        id: poly.id,
        name: poly.name,
        points: pts,
        minX,
        maxX,
        minY,
        maxY,
      });
    }
    return compiled;
  }

  static isPointInCompiledPolygon(x, y, poly) {
    if (x < poly.minX || x > poly.maxX || y < poly.minY || y > poly.maxY) {
      return false;
    }
    const pts = poly.points;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  isPointBlocked(x, y) {
    for (let i = 0; i < this.collisionPolygons.length; i++) {
      if (ClientPolygonMesh.isPointInCompiledPolygon(x, y, this.collisionPolygons[i])) {
        return true;
      }
    }
    return false;
  }

  getCharacterOpacityAt(x, y) {
    for (let i = 0; i < this.overlapPolygons.length; i++) {
      if (ClientPolygonMesh.isPointInCompiledPolygon(x, y, this.overlapPolygons[i])) {
        return this.overlapOpacity;
      }
    }
    return 1.0;
  }
}

window.ClientPolygonMesh = ClientPolygonMesh;
