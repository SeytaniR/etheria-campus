/**
 * @file apps/server/src/controllers/AdminWorldMapsSeeds.ts
 * @module @etheria/server
 * @description Seeds iniciais calibrados dos dois Mapas Gerais (Continente 1 e Continente 2)
 *   com camada base limpa (1264x848), logo Etheria Campus transparente e coordenadas exatas de pontos/rotas.
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
    pointsJson: [
    {
        "id": "pt_1",
        "refId": 1,
        "refLabel": "Ponto #1 (Cidade/Tribo)",
        "x": 480.3,
        "y": 271.1,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_2",
        "refId": 2,
        "refLabel": "Ponto #2 (Campo/Região)",
        "x": 556.2,
        "y": 310.2,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_3",
        "refId": 3,
        "refLabel": "Ponto #3 (Campo/Região)",
        "x": 490.2,
        "y": 217.4,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_4",
        "refId": 4,
        "refLabel": "Ponto #4 (Campo/Região)",
        "x": 407.3,
        "y": 204.4,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_5",
        "refId": 5,
        "refLabel": "Ponto #5 (Campo/Região)",
        "x": 498.6,
        "y": 391.4,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_6",
        "refId": 6,
        "refLabel": "Ponto #6 (Campo/Região)",
        "x": 539.3,
        "y": 394.3,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_7",
        "refId": 7,
        "refLabel": "Ponto #7 (Campo/Região)",
        "x": 551.9,
        "y": 517.5,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_8",
        "refId": 8,
        "refLabel": "Ponto #8 (Campo/Região)",
        "x": 428.4,
        "y": 343.5,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_9",
        "refId": 9,
        "refLabel": "Ponto #9 (Cidade/Tribo)",
        "x": 618,
        "y": 333.4,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_10",
        "refId": 10,
        "refLabel": "Ponto #10 (Cidade/Tribo)",
        "x": 723.3,
        "y": 171,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_11",
        "refId": 11,
        "refLabel": "Ponto #11 (Cidade/Tribo)",
        "x": 448,
        "y": 514.6,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_12",
        "refId": 12,
        "refLabel": "Ponto #12 (Cidade/Tribo)",
        "x": 817.4,
        "y": 318.9,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_13",
        "refId": 13,
        "refLabel": "Ponto #13 (Cidade/Tribo)",
        "x": 751.4,
        "y": 429.1,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_14",
        "refId": 14,
        "refLabel": "Ponto #14 (Campo/Região)",
        "x": 375,
        "y": 403,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_15",
        "refId": 15,
        "refLabel": "Ponto #15 (Campo/Região)",
        "x": 551.9,
        "y": 343.5,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_16",
        "refId": 16,
        "refLabel": "Ponto #16 (Campo/Região)",
        "x": 501.4,
        "y": 463.9,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_17",
        "refId": 17,
        "refLabel": "Ponto #17 (Campo/Região)",
        "x": 487.3,
        "y": 353.7,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_18",
        "refId": 18,
        "refLabel": "Ponto #18 (Campo/Região)",
        "x": 585.7,
        "y": 505.9,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_19",
        "refId": 19,
        "refLabel": "Ponto #19 (Campo/Região)",
        "x": 516.8,
        "y": 553.7,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_20",
        "refId": 20,
        "refLabel": "Ponto #20 (Campo/Região)",
        "x": 533.7,
        "y": 668.3,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_21",
        "refId": 21,
        "refLabel": "Ponto #21 (Campo/Região)",
        "x": 424.1,
        "y": 755.2,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_22",
        "refId": 22,
        "refLabel": "Ponto #22 (Campo/Região)",
        "x": 790.7,
        "y": 614.6,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_23",
        "refId": 23,
        "refLabel": "Ponto #23 (Campo/Região)",
        "x": 502.8,
        "y": 594.3,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_24",
        "refId": 24,
        "refLabel": "Ponto #24 (Campo/Região)",
        "x": 637.6,
        "y": 127.6,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_25",
        "refId": 25,
        "refLabel": "Ponto #25 (Cidade/Tribo)",
        "x": 637.6,
        "y": 226.1,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_26",
        "refId": 26,
        "refLabel": "Ponto #26 (Campo/Região)",
        "x": 723.3,
        "y": 239.2,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_27",
        "refId": 27,
        "refLabel": "Ponto #27 (Campo/Região)",
        "x": 759.8,
        "y": 126.1,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_28",
        "refId": 28,
        "refLabel": "Ponto #28 (Campo/Região)",
        "x": 707.8,
        "y": 87,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_29",
        "refId": 29,
        "refLabel": "Ponto #29 (Campo/Região)",
        "x": 480.3,
        "y": 624.8,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_30",
        "refId": 30,
        "refLabel": "Ponto #30 (Cidade/Tribo)",
        "x": 609.5,
        "y": 629.1,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_31",
        "refId": 31,
        "refLabel": "Ponto #31 (Cidade/Tribo)",
        "x": 880.6,
        "y": 505.9,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_32",
        "refId": 32,
        "refLabel": "Ponto #32 (Cidade/Tribo)",
        "x": 908.7,
        "y": 420.4,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_33",
        "refId": 33,
        "refLabel": "Ponto #33 (Campo/Região)",
        "x": 824.4,
        "y": 474,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_34",
        "refId": 34,
        "refLabel": "Ponto #34 (Campo/Região)",
        "x": 771,
        "y": 524.7,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_35",
        "refId": 35,
        "refLabel": "Ponto #35 (Campo/Região)",
        "x": 845.5,
        "y": 587.1,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_36",
        "refId": 36,
        "refLabel": "Ponto #36 (Campo/Região)",
        "x": 484.5,
        "y": 669.7,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_37",
        "refId": 37,
        "refLabel": "Ponto #37 (Campo/Região)",
        "x": 549.1,
        "y": 162.4,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_38",
        "refId": 38,
        "refLabel": "Ponto #38 (Cidade/Tribo)",
        "x": 373.6,
        "y": 624.8,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_39",
        "refId": 39,
        "refLabel": "Ponto #39 (Cidade/Tribo)",
        "x": 373.6,
        "y": 456.6,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_40",
        "refId": 40,
        "refLabel": "Ponto #40 (Campo/Região)",
        "x": 398.9,
        "y": 543.6,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_41",
        "refId": 41,
        "refLabel": "Ponto #41 (Campo/Região)",
        "x": 403.1,
        "y": 692.9,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_42",
        "refId": 42,
        "refLabel": "Ponto #42 (Campo/Região)",
        "x": 421.3,
        "y": 723.3,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_43",
        "refId": 43,
        "refLabel": "Ponto #43 (Campo/Região)",
        "x": 806.2,
        "y": 648,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_44",
        "refId": 44,
        "refLabel": "Ponto #44 (Campo/Região)",
        "x": 380.6,
        "y": 752.3,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    }
],
    routesJson: [
    {
        "from": "pt_1",
        "to": "pt_2"
    },
    {
        "from": "pt_1",
        "to": "pt_3"
    },
    {
        "from": "pt_1",
        "to": "pt_8"
    },
    {
        "from": "pt_2",
        "to": "pt_9"
    },
    {
        "from": "pt_2",
        "to": "pt_15"
    },
    {
        "from": "pt_2",
        "to": "pt_25"
    },
    {
        "from": "pt_3",
        "to": "pt_4"
    },
    {
        "from": "pt_3",
        "to": "pt_37"
    },
    {
        "from": "pt_5",
        "to": "pt_6"
    },
    {
        "from": "pt_5",
        "to": "pt_17"
    },
    {
        "from": "pt_6",
        "to": "pt_16"
    },
    {
        "from": "pt_7",
        "to": "pt_16"
    },
    {
        "from": "pt_7",
        "to": "pt_18"
    },
    {
        "from": "pt_7",
        "to": "pt_19"
    },
    {
        "from": "pt_8",
        "to": "pt_14"
    },
    {
        "from": "pt_9",
        "to": "pt_15"
    },
    {
        "from": "pt_10",
        "to": "pt_25"
    },
    {
        "from": "pt_10",
        "to": "pt_26"
    },
    {
        "from": "pt_10",
        "to": "pt_27"
    },
    {
        "from": "pt_11",
        "to": "pt_16"
    },
    {
        "from": "pt_11",
        "to": "pt_40"
    },
    {
        "from": "pt_12",
        "to": "pt_26"
    },
    {
        "from": "pt_13",
        "to": "pt_33"
    },
    {
        "from": "pt_14",
        "to": "pt_39"
    },
    {
        "from": "pt_15",
        "to": "pt_17"
    },
    {
        "from": "pt_19",
        "to": "pt_23"
    },
    {
        "from": "pt_20",
        "to": "pt_30"
    },
    {
        "from": "pt_20",
        "to": "pt_36"
    },
    {
        "from": "pt_21",
        "to": "pt_42"
    },
    {
        "from": "pt_21",
        "to": "pt_44"
    },
    {
        "from": "pt_22",
        "to": "pt_35"
    },
    {
        "from": "pt_22",
        "to": "pt_43"
    },
    {
        "from": "pt_23",
        "to": "pt_29"
    },
    {
        "from": "pt_24",
        "to": "pt_28"
    },
    {
        "from": "pt_24",
        "to": "pt_37"
    },
    {
        "from": "pt_25",
        "to": "pt_26"
    },
    {
        "from": "pt_27",
        "to": "pt_28"
    },
    {
        "from": "pt_29",
        "to": "pt_36"
    },
    {
        "from": "pt_29",
        "to": "pt_38"
    },
    {
        "from": "pt_31",
        "to": "pt_33"
    },
    {
        "from": "pt_31",
        "to": "pt_34"
    },
    {
        "from": "pt_31",
        "to": "pt_35"
    },
    {
        "from": "pt_32",
        "to": "pt_33"
    },
    {
        "from": "pt_33",
        "to": "pt_34"
    },
    {
        "from": "pt_34",
        "to": "pt_35"
    },
    {
        "from": "pt_38",
        "to": "pt_40"
    },
    {
        "from": "pt_38",
        "to": "pt_41"
    },
    {
        "from": "pt_39",
        "to": "pt_40"
    },
    {
        "from": "pt_41",
        "to": "pt_42"
    }
],
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
    pointsJson: [
    {
        "id": "pt_55",
        "refId": 55,
        "refLabel": "Ponto #55 (Cidade/Tribo)",
        "x": 539.5,
        "y": 202.9,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_56",
        "refId": 56,
        "refLabel": "Ponto #56 (Campo/Região)",
        "x": 598.8,
        "y": 300.1,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_71",
        "refId": 71,
        "refLabel": "Ponto #71 (Cidade/Tribo)",
        "x": 661,
        "y": 388.5,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_61",
        "refId": 61,
        "refLabel": "Ponto #61 (Campo/Região)",
        "x": 406.7,
        "y": 646.5,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_67",
        "refId": 67,
        "refLabel": "Ponto #67 (Campo/Região)",
        "x": 460.4,
        "y": 598.7,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_70",
        "refId": 70,
        "refLabel": "Ponto #70 (Campo/Região)",
        "x": 529.6,
        "y": 539.2,
        "isCity": false,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_88",
        "refId": 88,
        "refLabel": "Ponto #88 (Cidade/Tribo)",
        "x": 813.5,
        "y": 292.8,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    },
    {
        "id": "pt_525",
        "refId": 525,
        "refLabel": "Ponto #525 (Cidade/Tribo)",
        "x": 747.1,
        "y": 690,
        "isCity": true,
        "gameMapId": null,
        "customLabel": ""
    }
],
    routesJson: [
    {
        "from": "pt_55",
        "to": "pt_56"
    },
    {
        "from": "pt_61",
        "to": "pt_67"
    },
    {
        "from": "pt_67",
        "to": "pt_70"
    }
],
  },
];
