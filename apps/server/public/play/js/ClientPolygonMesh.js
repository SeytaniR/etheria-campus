/**
 * @file apps/server/public/play/js/ClientPolygonMesh.js
 * @module @etheria/server
 * @description Malha Poligonal de Colisão, Sobreposição 2.5D e Pathfinding A* com String Pulling (Raycast Smoothing).
 */

class FastMinHeap {
  constructor() {
    this.nodes = [];
    this.scores = [];
  }
  push(n, s) {
    this.nodes.push(n);
    this.scores.push(s);
    this._up(this.nodes.length - 1);
  }
  pop() {
    if (!this.nodes.length) return -1;
    const t = this.nodes[0];
    const l = this.nodes.pop();
    const ls = this.scores.pop();
    if (this.nodes.length) {
      this.nodes[0] = l;
      this.scores[0] = ls;
      this._down(0);
    }
    return t;
  }
  _up(n) {
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (this.scores[n] < this.scores[p]) {
        this._swap(n, p);
        n = p;
      } else break;
    }
  }
  _down(n) {
    const l = this.nodes.length;
    while (true) {
      let m = n;
      const a = 2 * n + 1;
      const b = 2 * n + 2;
      if (a < l && this.scores[a] < this.scores[m]) m = a;
      if (b < l && this.scores[b] < this.scores[m]) m = b;
      if (m !== n) {
        this._swap(n, m);
        n = m;
      } else break;
    }
  }
  _swap(i, j) {
    const tn = this.nodes[i]; this.nodes[i] = this.nodes[j]; this.nodes[j] = tn;
    const ts = this.scores[i]; this.scores[i] = this.scores[j]; this.scores[j] = ts;
  }
  get size() {
    return this.nodes.length;
  }
}

class ClientPolygonMesh {
  constructor(collisionPolygons = [], overlapPolygons = [], overlapOpacity = 0.45) {
    this.collisionPolygons = this.compileBounds(collisionPolygons);
    this.overlapPolygons = this.compileBounds(overlapPolygons);
    this.overlapOpacity = Math.max(0.1, Math.min(1.0, Number(overlapOpacity) || 0.45));

    // Grade de Navegação para Desvio Automático de Obstáculos (Pathfinding)
    this.navCellSize = 28;
    this.navCols = 0;
    this.navRows = 0;
    this.navGrid = null;
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

  isPointInCollision(x, y) {
    return this.isPointBlocked(x, y);
  }

  getCharacterOpacityAt(x, y) {
    for (let i = 0; i < this.overlapPolygons.length; i++) {
      if (ClientPolygonMesh.isPointInCompiledPolygon(x, y, this.overlapPolygons[i])) {
        return this.overlapOpacity;
      }
    }
    return 1.0;
  }

  getIntersectingOverlapPolygons(x, y, w, h) {
    if (!this.overlapPolygons || this.overlapPolygons.length === 0) return [];
    const minX = x;
    const maxX = x + w;
    const minY = y;
    const maxY = y + h;

    const hits = [];
    for (let i = 0; i < this.overlapPolygons.length; i++) {
      const poly = this.overlapPolygons[i];
      if (!(maxX < poly.minX || minX > poly.maxX || maxY < poly.minY || minY > poly.maxY)) {
        hits.push(poly);
      }
    }
    return hits;
  }

  /**
   * Constrói a grade espacial binária (Uint8Array) para A* ultrarrápido (<1ms).
   */
  initNavGrid(mapWidth, mapHeight) {
    let maxW = Number(mapWidth) || 0;
    let maxH = Number(mapHeight) || 0;

    for (const p of this.collisionPolygons) {
      if (p.maxX > maxW) maxW = p.maxX + 120;
      if (p.maxY > maxH) maxH = p.maxY + 120;
    }
    maxW = Math.max(maxW, 2200);
    maxH = Math.max(maxH, 1600);

    const cs = this.navCellSize;
    this.navCols = Math.ceil(maxW / cs);
    this.navRows = Math.ceil(maxH / cs);
    const total = this.navCols * this.navRows;
    this.navGrid = new Uint8Array(total);

    for (let r = 0; r < this.navRows; r++) {
      for (let c = 0; c < this.navCols; c++) {
        const cx = c * cs + cs / 2;
        const cy = r * cs + cs / 2;
        if (
          this.isPointBlocked(cx, cy) ||
          this.isPointBlocked(cx - 7, cy) ||
          this.isPointBlocked(cx + 7, cy) ||
          this.isPointBlocked(cx, cy - 7) ||
          this.isPointBlocked(cx, cy + 7)
        ) {
          this.navGrid[r * this.navCols + c] = 1;
        }
      }
    }
  }

  isCellBlocked(c, r) {
    if (!this.navGrid) return false;
    if (c < 0 || c >= this.navCols || r < 0 || r >= this.navRows) return true;
    return this.navGrid[r * this.navCols + c] === 1;
  }

  /**
   * Verifica se o segmento de reta entre dois pontos está 100% desobstruído.
   */
  isSegmentClear(x1, y1, x2, y2, step = 14) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return !this.isPointBlocked(x2, y2);

    const segMinX = Math.min(x1, x2);
    const segMaxX = Math.max(x1, x2);
    const segMinY = Math.min(y1, y2);
    const segMaxY = Math.max(y1, y2);

    let hasOverlappingPoly = false;
    for (let i = 0; i < this.collisionPolygons.length; i++) {
      const p = this.collisionPolygons[i];
      if (!(segMaxX < p.minX || segMinX > p.maxX || segMaxY < p.minY || segMinY > p.maxY)) {
        hasOverlappingPoly = true;
        break;
      }
    }
    if (!hasOverlappingPoly) return true;

    const steps = Math.ceil(dist / step);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 1; i <= steps; i++) {
      const curX = i === steps ? x2 : x1 + stepX * i;
      const curY = i === steps ? y2 : y1 + stepY * i;
      if (this.isPointBlocked(curX, curY)) return false;
    }
    return true;
  }

  /**
   * Encontra caminho navegável evitando obstáculos (cercas, rochas, paredes).
   * Retorna array de waypoints simplificados via String Pulling.
   */
  findPath(startX, startY, targetX, targetY) {
    if (!this.navGrid) {
      this.initNavGrid();
    }

    // 1. Rota direta desobstruída (0.01ms)
    if (this.isSegmentClear(startX, startY, targetX, targetY, 14)) {
      return [{ x: targetX, y: targetY }];
    }

    const cs = this.navCellSize;
    let sc = Math.floor(startX / cs);
    let sr = Math.floor(startY / cs);
    let tc = Math.floor(targetX / cs);
    let tr = Math.floor(targetY / cs);

    if (this.isCellBlocked(sc, sr)) {
      const nearStart = this.findClosestWalkableCell(sc, sr, 4);
      if (nearStart) {
        sc = nearStart.c;
        sr = nearStart.r;
      }
    }

    if (this.isCellBlocked(tc, tr)) {
      const nearEnd = this.findClosestWalkableCell(tc, tr, 6);
      if (nearEnd) {
        tc = nearEnd.c;
        tr = nearEnd.r;
        targetX = tc * cs + cs / 2;
        targetY = tr * cs + cs / 2;
      } else {
        return [];
      }
    }

    const total = this.navCols * this.navRows;
    const g = new Float32Array(total).fill(Infinity);
    const parent = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap = new FastMinHeap();

    const startIdx = sr * this.navCols + sc;
    const targetIdx = tr * this.navCols + tc;
    g[startIdx] = 0;
    heap.push(startIdx, 0);

    const dirs = [
      [0, 1, 1], [0, -1, 1], [1, 0, 1], [-1, 0, 1],
      [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414],
    ];

    let found = false;
    let expanded = 0;
    const maxExpansion = 2400;

    while (heap.size > 0) {
      const cur = heap.pop();
      if (cur === targetIdx) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      expanded++;
      if (expanded > maxExpansion) break;

      const cc = cur % this.navCols;
      const cr = Math.floor(cur / this.navCols);
      const curG = g[cur];

      for (let i = 0; i < 8; i++) {
        const [dc, dr, cost] = dirs[i];
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nc >= this.navCols || nr < 0 || nr >= this.navRows) continue;
        const nIdx = nr * this.navCols + nc;
        if (this.navGrid[nIdx] === 1 || closed[nIdx]) continue;

        if (i >= 4) {
          if (this.navGrid[cr * this.navCols + nc] === 1 || this.navGrid[nr * this.navCols + cc] === 1) {
            continue;
          }
        }

        const ng = curG + cost;
        if (ng < g[nIdx]) {
          g[nIdx] = ng;
          parent[nIdx] = cur;
          const h = Math.max(Math.abs(nc - tc), Math.abs(nr - tr)) + 0.414 * Math.min(Math.abs(nc - tc), Math.abs(nr - tr));
          heap.push(nIdx, ng + h);
        }
      }
    }

    if (!found) return [];

    const raw = [];
    let curr = targetIdx;
    while (curr !== startIdx && curr !== -1) {
      const c = curr % this.navCols;
      const r = Math.floor(curr / this.navCols);
      raw.push({ x: c * cs + cs / 2, y: r * cs + cs / 2 });
      curr = parent[curr];
    }
    raw.reverse();
    if (raw.length > 0) {
      raw[raw.length - 1] = { x: targetX, y: targetY };
    }

    return this.smoothPath(startX, startY, raw);
  }

  smoothPath(startX, startY, rawWaypoints) {
    if (rawWaypoints.length <= 1) return rawWaypoints;
    const smoothed = [];
    let curPt = { x: startX, y: startY };
    let idx = 0;

    while (idx < rawWaypoints.length) {
      let furthest = idx;
      for (let j = rawWaypoints.length - 1; j > idx; j--) {
        if (this.isSegmentClear(curPt.x, curPt.y, rawWaypoints[j].x, rawWaypoints[j].y, 14)) {
          furthest = j;
          break;
        }
      }
      smoothed.push(rawWaypoints[furthest]);
      curPt = rawWaypoints[furthest];
      idx = furthest + 1;
    }
    return smoothed;
  }

  findClosestWalkableCell(c, r, maxRad = 6) {
    let closest = null;
    let minDistSq = Infinity;
    for (let rad = 1; rad <= maxRad; rad++) {
      for (let dc = -rad; dc <= rad; dc++) {
        for (let dr = -rad; dr <= rad; dr++) {
          if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.isCellBlocked(nc, nr)) {
            const dSq = dc * dc + dr * dr;
            if (dSq < minDistSq) {
              minDistSq = dSq;
              closest = { c: nc, r: nr };
            }
          }
        }
      }
      if (closest) break;
    }
    return closest;
  }
}

window.ClientPolygonMesh = ClientPolygonMesh;
