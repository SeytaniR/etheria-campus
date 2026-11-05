/**
 * @file packages/shared/src/MapPolygonMesh.ts
 * @module @etheria/shared
 * @description Classe Orientada a Objetos para representação e cálculo geométrico de malhas
 *   de Polígonos Estilo Google Earth (Colisão e Sobreposição de Opacidade dos Mapas).
 * @rules Utilizada tanto pelo Servidor Autoritário (validação anti-cheat de movimento)
 *   quanto pelo Cliente WebGL (colisão preditiva e máscara de opacidade).
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
}
