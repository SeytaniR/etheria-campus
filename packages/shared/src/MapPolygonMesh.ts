/**
 * @file packages/shared/src/MapPolygonMesh.ts
 * @module @etheria/shared
 * @description Classe Orientada a Objetos para representação e cálculo geométrico de malhas
 *   de Polígonos Estilo Google Earth (Colisão e Sobreposição de Opacidade dos Mapas).
 * @rules Utilizada tanto pelo Servidor Autoritário (validação anti-cheat de movimento)
 *   quanto pelo Cliente WebGL (colisão preditiva e máscara de opacidade).
 * @dependencies Sem dependências externas (algoritmo geométrico puro Point-in-Polygon + AABB).
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface MapPolygon {
  id: string;
  name: string;
  points: Point2D[];
}

export interface ClosestPolygonPointResult {
  polygon: MapPolygon;
  point: Point2D;
  distance: number;
  inside: boolean;
}

interface CompiledPolygon {
  polygon: MapPolygon;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Gerencia uma coleção de polígonos fechados de um mapa (Colisão ou Sobreposição)
 * e realiza testes ultra-rápidos Point-in-Polygon com Bounding Box (AABB) pré-calculada em O(1).
 */
export class MapPolygonMesh {
  private readonly polygons: MapPolygon[];
  private readonly compiled: CompiledPolygon[];

  constructor(polygons: MapPolygon[] = []) {
    this.polygons = Array.isArray(polygons) ? polygons : [];
    this.compiled = [];

    for (const poly of this.polygons) {
      if (!Array.isArray(poly.points) || poly.points.length < 3) continue;
      let minX = poly.points[0].x;
      let maxX = poly.points[0].x;
      let minY = poly.points[0].y;
      let maxY = poly.points[0].y;

      for (let i = 1; i < poly.points.length; i++) {
        const p = poly.points[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      this.compiled.push({
        polygon: poly,
        minX,
        maxX,
        minY,
        maxY,
      });
    }
  }

  /**
   * Retorna todos os polígonos válidos (com pelo menos 3 vértices).
   */
  public getPolygons(): MapPolygon[] {
    return this.compiled.map((c) => c.polygon);
  }

  /**
   * Verifica se uma coordenada (x, y) está dentro de qualquer polígono da malha.
   * Descarta em O(1) (4 comparações de float) qualquer polígono cujo Bounding Box não contenha (x, y).
   */
  public containsPoint(x: number, y: number): boolean {
    for (let i = 0; i < this.compiled.length; i++) {
      const c = this.compiled[i];
      if (x < c.minX || x > c.maxX || y < c.minY || y > c.maxY) {
        continue;
      }
      if (MapPolygonMesh.rayCastPoints(x, y, c.polygon.points)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Algoritmo Ray-Casting (Even-Odd Rule) com verificação de Bounding Box para uso estático.
   */
  public static isPointInPolygon(x: number, y: number, points: Point2D[]): boolean {
    if (!points || points.length < 3) return false;

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (x < minX || x > maxX || y < minY || y > maxY) {
      return false;
    }

    return MapPolygonMesh.rayCastPoints(x, y, points);
  }

  /**
   * Executa o teste puro de interseção de semirreta nos segmentos do polígono.
   */
  private static rayCastPoints(x: number, y: number, points: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Projeta o ponto (px, py) sobre o segmento (ax, ay)-(bx, by) e retorna o ponto mais próximo e sua distância.
   */
  public static closestPointOnSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
  ): { x: number; y: number; distance: number } {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 1e-9) {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return { x: cx, y: cy, distance: Math.hypot(px - cx, py - cy) };
  }

  /**
   * Encontra o polígono e ponto mais próximo dentro de `maxDistance` (0 se estiver dentro do polígono).
   */
  public findClosestPoint(x: number, y: number, maxDistance = Infinity): ClosestPolygonPointResult | null {
    for (let i = 0; i < this.compiled.length; i++) {
      const c = this.compiled[i];
      if (x >= c.minX && x <= c.maxX && y >= c.minY && y <= c.maxY) {
        if (MapPolygonMesh.rayCastPoints(x, y, c.polygon.points)) {
          return { polygon: c.polygon, point: { x, y }, distance: 0, inside: true };
        }
      }
    }

    let best: ClosestPolygonPointResult | null = null;
    for (let i = 0; i < this.compiled.length; i++) {
      const c = this.compiled[i];
      if (
        Number.isFinite(maxDistance) &&
        (x < c.minX - maxDistance || x > c.maxX + maxDistance || y < c.minY - maxDistance || y > c.maxY + maxDistance)
      ) {
        continue;
      }
      const pts = c.polygon.points;
      for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) {
        const proj = MapPolygonMesh.closestPointOnSegment(x, y, pts[j].x, pts[j].y, pts[k].x, pts[k].y);
        if (proj.distance <= maxDistance && (!best || proj.distance < best.distance)) {
          best = {
            polygon: c.polygon,
            point: { x: proj.x, y: proj.y },
            distance: proj.distance,
            inside: false,
          };
        }
      }
    }
    return best;
  }
}
