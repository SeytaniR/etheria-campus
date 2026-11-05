# 🗄️ Modelagem do Banco de Dados Low-Code & Procedural (Etheria Campus)

> **REGRA DA CURADORIA ("WHITELIST"):**
> Nenhum arquivo do repositório `mcrework` entra no jogo automaticamente. Somente registros cadastrados nas tabelas abaixo através da **Rota `/admin`** existem no jogo.

---

## 1. Bloco A — Mundo, 40 Biomas, 5 Tipos de Mapa e Mapas

### 1.1. Tabela `map_types` (5 Tipos Fixos com Dominação, Spawn e PvP)
Os parâmetros de **Dominação**, **Spawn de Monstros** e **Regra de PvP** são fixados diretamente nesta tabela:

| `code` | Nome | `domination_target` | `allow_monster_spawn` | `pvp_rule` | `forces_criminal_status` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `CITY` | Cidade | `ALLIANCE` (Aliança de Facções) | `false` | `DUEL_ONLY` | `false` |
| `VILLAGE` | Vila | `ALLIANCE` (Aliança de Facções) | `false` | `DUEL_ONLY` | `false` |
| `SUBURB` | Subúrbio | `FACTION` (Facção) | `true` | `DUEL_ONLY` | `false` |
| `HOSTILE_ZONE` | Zona Hostil | `FACTION` (Facção) | `true` | `FORCED_PK` | `true` (Vira Criminoso) |
| `CONFLICT_ZONE` | Zona de Conflito | `FACTION` (Facção) | `true` | `OPEN_PVP` | `false` |

### 1.2. Tabela `biomes` (Os 40 Biomas para Cruzamento Procedural de Spawn)
> **Regra:** Biomas possuem apenas `id`, `code`, `category`, `name_i18n_key` e `description_i18n_key`. Não possuem vínculo com elementos nem interferem em cálculo de dano. Sua única função é o vínculo `Mapa <-> Bioma <-> Monstro`.

1. `VERDANT_PLAINS` — Planície Verdejante (Campos abertos de grama baixa e clima ameno)
2. `TEMPERATE_WOODS` — Bosque Temperado (Árvores espaçadas com luz solar filtrada e fauna silvestre)
3. `DENSE_FOREST` — Floresta Densa (Vegetação fechada de árvores antigas e copas altas)
4. `TROPICAL_JUNGLE` — Selva Tropical (Mata úmida, cipós e plantas/répteis tropicais)
5. `BAMBOO_GROVE` — Floresta de Bambu (Bosques orientais altos e silenciosos)
6. `FAIRY_GARDEN` — Jardim Feérico (Floresta encantada com flores gigantes luminescentes)
7. `AUTUMN_WOODS` — Bosque Outonal (Floresta de folhas douradas e avermelhadas)
8. `GIANT_ROOTS` — Raízes Gigantes (Sub-bosque formado por raízes colossais)
9. `DRY_STEPPES` — Estepes Secas (Terras áridas de vegetação rasteira amarelada)
10. `SAND_DUNES` — Deserto de Dunas (Mar de areia escaldante e tempestades solares)
11. `HIDDEN_OASIS` — Oásis Escondido (Refúgio fértil de água cristalina no deserto)
12. `ROCKY_CANYON` — Cânion Rochoso (Desfiladeiros estreitos de pedra avermelhada)
13. `ALPINE_HIGHLANDS` — Cordilheira Alpina (Montanhas altas de pedra fria e ar rarefeito)
14. `DEEP_CAVERN` — Caverna Subterrânea (Túneis escuros de pedra úmida e estalactites)
15. `CRYSTAL_MINE` — Mina de Cristais (Grutas iluminadas por veios de minérios e cristais)
16. `BADLANDS` — Terras Devastadas (Solo rachado, seco e hostil sem vegetação)
17. `TROPICAL_COAST` — Costa Tropical (Praias de areia clara e recifes rasos)
18. `SEA_CLIFFS` — Penhasco Marítimo (Rochas costeiras açoitadas por ondas fortes)
19. `MISTY_SWAMP` — Pântano Nebuloso (Águas paradas e lamacentas cobertas por neblina)
20. `POISON_MANGROVE` — Manguezal Venenoso (Charco tóxico de águas esverdeadas e esporos)
21. `MIRROR_LAKE` — Lago Espelhado (Margens de grandes lagos serenos e cristalinos)
22. `CORAL_REEF` — Recife de Corais (Ambiente costeiro/submerso repleto de corais)
23. `ABYSSAL_TRENCH` — Fenda Abissal (Profundezas oceânicas escuras sob alta pressão)
24. `FROZEN_TUNDRA` — Tundra Congelada (Planícies cobertas de geada e neve rasa)
25. `SNOWY_TAIGA` — Floresta Boreal Nevada (Pinheiros cobertos de neve pesada)
26. `ETERNAL_GLACIER` — Geleira Eterna (Paredes e pontes de gelo puro translúcido)
27. `BLIZZARD_PEAK` — Pico da Nevasca (Topo de montanha sob tempestade de neve perpétua)
28. `ASHLANDS` — Campos de Cinzas (Terra coberta por fuligem vulcânica e fumaça)
29. `LAVA_CALDERA` — Caldeira de Lava (Rios de magma incandescente e rocha derretida)
30. `STORM_PLATEAU` — Platô das Tempestades (Região elevada atingida por raios constantes)
31. `FLOATING_ISLANDS` — Ilhas Flutuantes (Fragmentos de terra suspensos no céu)
32. `DEADWOOD` — Floresta Morta (Árvores secas e retorcidas sob noite eterna)
33. `ANCIENT_NECROPOLIS` — Necrópole Antiga (Cemitérios monumentais e mausoléus)
34. `BLIGHTED_LANDS` — Terras Corrompidas (Solo contaminado por miasma sombrio)
35. `DEMONIC_RIFT` — Fenda Demoníaca (Território dimensional rasgado pelo submundo)
36. `ACADEMY_GROUNDS` — Jardins da Academia (Pátios pavimentados, fontes e bibliotecas do Campus)
37. `ANCIENT_RUINS` — Ruínas Ancestrais (Templos de pedra de uma civilização perdida)
38. `ASTRAL_SANCTUARY` — Santuário Astral (Dimensão etérea com céu estrelado no horizonte)
39. `CLOCKWORK_FORGE` — Forja Mecânica (Complexo de engrenagens a vapor e magia tecno-arcana)
40. `CELESTIAL_PALACE` — Palácio Celestial (Salões de mármore branco e ouro acima das nuvens)

### 1.3. Tabelas de Mapas (`maps`, `map_portals`, `map_npcs`)
* **`maps`:**
  * `id`, `mcrework_map_folder` (`map1..map76`), `name_i18n_key`, `required_level` (1, 10, 20, 30...), `map_type_id` (FK para `map_types`), `primary_biome_id` (FK para `biomes`), `secondary_biome_id` (FK para `biomes`), `controlling_faction_id` / `controlling_alliance_id` (nullable), `is_active`.
* **`map_portals` (Pontos de Teleporte):**
  * `id`, `source_map_id`, `source_x`, `source_y`, `target_map_id`, `target_x`, `target_y`, `portal_vfx_key`.
* **`map_npcs` (NPCs e Posições):**
  * `id`, `map_id`, `npc_template_id`, `pos_x`, `pos_y`, `direction`.

---

## 2. Bloco B — Elementos, Raças, Atributos e Entidades

### 2.1. Tabela `elements` e `element_matchups` (5 Elementos)
* **`elements`:**
  * `FIRE` (Fogo), `EARTH` (Terra), `AIR` (Ar), `WATER` (Água), `NEUTRAL` (Neutro).
  * Pesos de sorteio inicial para Personagens e Pets: `NEUTRAL = 10%` (peso 10), `FIRE = 20%`, `EARTH = 20%`, `AIR = 20%`, `WATER = 20%` (configurável no Admin).
* **`element_matchups`:**
  * Ciclo Ativo (`+25%` de dano causado / `-25%` sofrido): `FIRE > EARTH > AIR > WATER > FIRE`.
  * Regra `NEUTRAL`: Causa `-25%` (`0.75x`) contra qualquer elemento e recebe `+25%` (`1.25x`) de qualquer elemento.

### 2.2. Tabela `races` e `race_matchups` (11 Raças — Vantagem de `10%`)
* **`races`:**
  1. `HUMAN` (Humanos) — `+10%` de vantagem sobre todas as outras 10 raças.
  2. `PLANT` (Plantas) — `+10%` sobre `DRAGON`
  3. `DRAGON` (Dragões) — `+10%` sobre `REPTILIAN`
  4. `REPTILIAN` (Reptilianos) — `+10%` sobre `AQUATIC`
  5. `AQUATIC` (Aquáticos) — `+10%` sobre `ROBOTIC`
  6. `ROBOTIC` (Robóticos) — `+10%` sobre `CELESTIAL`
  7. `CELESTIAL` (Celestiais) — `+10%` sobre `DEMON`
  8. `DEMON` (Demônios) — `+10%` sobre `FAIRY`
  9. `FAIRY` (Fadas) — `+10%` sobre `SPIRIT`
  10. `SPIRIT` (Espíritos) — `+10%` sobre `BEAST`
  11. `BEAST` (Selvagens) — `+10%` sobre `PLANT`

### 2.3. Tabelas de Atributos (`base_attributes`, `combat_attributes`, `attribute_conversions`)
* **`base_attributes`:** `VIT`, `STR`, `INT`, `WIS`, `AGI`, `DEX`.
* **`combat_attributes`:** `MAX_HP`, `MAX_MP`, `PHYS_ATK`, `MAG_ATK`, `PHYS_DEF`, `MAG_DEF`, `PHYS_PEN`, `MAG_PEN`, `HEAL_POWER`, `SPEED`, `EVASION`, `ACCURACY`, `CRIT_RATE`, `CRIT_DMG`, `STATUS_HIT_RATE`, `DOT_RESIST`.
* **`attribute_conversions`:** Matriz low-code que define quanto 1 ponto de cada Atributo Base soma em cada Atributo de Combate.

### 2.4. Tabelas de Entidades (`class_templates`, `monster_rarities`, `monster_templates`, `monster_biomes`)
* **`class_templates` (Personagens Jogáveis):**
  * `id`, `mcrework_char_key`, `name_i18n_key`, `race_code` (padrão `HUMAN`), `base_attributes_json`, `growth_per_level_json`, `skill_ids_json`. *(Elemento sorteado ao criar o personagem).*
* **`monster_rarities`:**
  * `COMMON`, `UNCOMMON`, `ELITE`, `RARE`, `MINIBOSS`, `BOSS` (com multiplicadores de status, EXP, drop e escala visual).
* **`monster_templates` (Monstros e Templates de Pets):**
  * `id`, `mcrework_monster_key`, `name_i18n_key`, `race_code` (FK para `races`), `fixed_element_code` (FK para `elements` — usado quando é monstro inimigo; se capturado como Pet, sorteia elemento inicial), `default_rarity_id`, `is_tamable_as_pet`, `base_attributes_seed_json`, `skill_ids_json`, `loot_table_id`.
* **`monster_biomes` (Vínculo Procedural `Monstro <-> Bioma`):**
  * `monster_template_id`, `biome_id`.

---

## 3. Bloco C — Habilidades (Blocos de Efeito), Formações 10x10 e Itens

* **`skill_templates`:**
  * `id`, `name_i18n_key`, `description_i18n_key`, `mcrework_icon_key`, `cast_action_id`, `mcrework_vfx_key`, `skill_type` (`ACTIVE` | `PASSIVE`), `trigger_type` (`MANUAL_AP`, `PASSIVE_ALWAYS`, `ON_TURN_START`, `ON_HIT`, `ON_CRIT`, `ON_DAMAGE_TAKEN`, `ON_KILL`), `ap_cost`, `cooldown_turns`, `target_scope` (`MELEE_FRONTLINE`, `RANGED_SINGLE`, `ROW_FRONT`, `ROW_BACK`, `COLUMN_PIERCE`, `CROSS`, `ALL_ENEMIES`, `SELF`, `ALLY_SINGLE`, `ALLY_ALL`), `effect_blocks_json` (Lista dos 7 blocos: `DAMAGE`, `HEAL`, `SHIELD`, `STATUS`, `MOVE_SLOT`, `CLEANSE_DISPEL`, `RESOURCE`).
* **`status_effect_templates` (Buffs e Debuffs):**
  * `id`, `code`, `name_i18n_key`, `icon_key`, `is_buff` (boolean), `max_stacks`, `default_duration_turns`, `stat_modifiers_json`, `dot_hot_formula_json`, `control_flags_json` (`STUN`, `SILENCE`, `FREEZE`, `ROOT`).
* **`arena_formations` (10 Slots por Equipe):**
  * `id`, `owner_id`, `slot_1`..`slot_5` (Vanguarda), `slot_6`..`slot_10` (Retaguarda).
* **`item_templates` (Armas, Equipamentos, Consumíveis, Troca de Elemento):**
  * `id`, `name_i18n_key`, `mcrework_icon_key`, `item_category` (`WEAPON`, `ARMOR`, `ACCESSORY`, `MOUNT`, `CONSUMABLE`, `ELEMENT_CHANGER`), `required_level`, `stat_bonuses_json`, `special_effect_json`.
