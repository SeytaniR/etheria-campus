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

/**
 * Gerencia uma coleção de polígonos fechados de um mapa (Colisão ou Sobreposição)
 * e realiza testes rápidos Point-in-Polygon com pré-filtro de Bounding Box (AABB).
 */
export class MapPolygonMesh {
  private readonly polygons: MapPolygon[];

  constructor(polygons: MapPolygon[] = []) {
    this.polygons = Array.isArray(polygons) ? polygons : [];
  }

  /**
   * Retorna todos os polígonos válidos (com pelo menos 3 vértices).
   */
  public getPolygons(): MapPolygon[] {
    return this.polygons.filter((p) => Array.isArray(p.points) && p.points.length >= 3);
  }

  /**
   * Verifica se uma coordenada (x, y) está dentro de qualquer polígono da malha.
   * Usa algoritmo Ray-Casting precedido por verificação de Bounding Box em O(1).
   */
  public containsPoint(x: number, y: number): boolean {
    for (const poly of this.getPolygons()) {
      if (MapPolygonMesh.isPointInPolygon(x, y, poly.points)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Algoritmo Ray-Casting (Even-Odd Rule) para determinar se (x, y) pertence ao polígono fechado.
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
