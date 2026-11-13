/**
 * @file apps/server/src/controllers/AdminWorldMapsSeeds.ts
 * @module @etheria/server
 * @description Seeds iniciais dos dois Mapas Gerais (Continente 1 e Continente 2)
 *   com base limpa e logo transparente, prontos para criação de pontos e rotas customizadas.
 */

export interface WorldMapPointSeed {
  id: string;
  refId: number;
  refLabel: string;
  x: number;
  y: number;
  isCity: boolean;
  gameMapId: number | null;
  customLabel: string;
}

export interface WorldMapRouteSeed {
  from: string;
  to: string;
}

export interface WorldMapTemplateSeed {
  code: string;
  namePtBr: string;
  baseImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  logoImageUrl: string;
  logoX: number;
  logoY: number;
  logoWidth: number;
  logoHeight: number;
  logoVisible: boolean;
  showRoutesLayer: boolean;
  showPointsLayer: boolean;
  pointsJson: WorldMapPointSeed[];
  routesJson: WorldMapRouteSeed[];
}

export const INITIAL_WORLD_MAP_SEEDS: WorldMapTemplateSeed[] = [
  {
    code: 'continent_1',
    namePtBr: 'Continente 1 — Terra Central',
    baseImageUrl: '/assets/worldmap/world_map_1_base.png',
    canvasWidth: 1264,
    canvasHeight: 848,
    logoImageUrl: '/assets/worldmap/etheria_campus_logo.png',
    logoX: 38,
    logoY: 28,
    logoWidth: 270,
    logoHeight: 185,
    logoVisible: true,
    showRoutesLayer: true,
    showPointsLayer: true,
    pointsJson: [],
    routesJson: [],
  },
  {
    code: 'continent_2',
    namePtBr: 'Continente 2 — Terras Perdidas',
    baseImageUrl: '/assets/worldmap/world_map_2_base.png',
    canvasWidth: 1264,
    canvasHeight: 848,
    logoImageUrl: '/assets/worldmap/etheria_campus_logo.png',
    logoX: 38,
    logoY: 28,
    logoWidth: 270,
    logoHeight: 185,
    logoVisible: true,
    showRoutesLayer: true,
    showPointsLayer: true,
    pointsJson: [],
    routesJson: [],
  },
];
