# 🗄️ Modelagem do Banco de Dados Low-Code & Procedural (`v0.66.0`)

> **REGRA DA CURADORIA ("WHITELIST") & INDEPENDÊNCIA (`Regra #10`):**
> Nenhum arquivo de `mcrework` entra no jogo automaticamente. Somente registros cadastrados nas tabelas abaixo pela Rota `/admin` existem no jogo, e seus assets são espelhados localmente no salvamento (`apps/server/cache/mcrework/`).
>
> **PROTEÇÃO DE DADOS (`Cláusula 0.2`):** Schema atualizado com **34 modelos Prisma** e **11 índices `@@index`**. Nenhuma alteração/remoção em dados reais ocorre sem autorização explícita do usuário.

---

## 1. Bloco A — Internacionalização Multi-Locale (`i18n`)

* **`i18n_translations` (`I18nTranslation`):**
  * `id`, `key` (`i18n_key`), `locale` (`pt-BR`, `en`, `en-US`, `es-ES`), `text`, `updated_at`.
  * Constraint `@@unique([key, locale])` e índice `@@index([key])`.
  * Em memória, `I18nCache` aplica fallback em camadas sem mutar registros legados (`pt-BR` base → `en` + `en-US` para inglês; `pt-BR` → `es-ES` para espanhol).

---

## 2. Bloco B — Mundo, 40 Biomas, 6 Tipos de Mapa, Portais, NPCs & Dungeons

* **`map_types` (`MapType`):** `CITY`, `VILLAGE`, `SUBURB`, `HOSTILE_ZONE`, `CONFLICT_ZONE` e `DUNGEON` (`domination_target`: `ALLIANCE`/`FACTION`/`NONE`, `allow_monster_spawn`, `pvp_rule`, `forces_criminal_status`).
* **`biomes` (`Biome`):** Os **40 biomas** de mundo usados exclusivamente para cruzamento procedural `Mapa <-> Bioma <-> Monstro` (`id`, `code`, `category`, `name_i18n_key`, `description_i18n_key`).
* **`maps` (`GameMap`):**
  * `id`, `code`, `mcrework_map_image`, `name_i18n_key`, `required_level`, `level_variance_min/max`, `map_type_id`, `primary_biome_id`, `secondary_biome_id`, `encounter_rate_pct`, `allowed_monster_races_json`, `allowed_monster_template_ids_json`, `dungeon_monster_count`, `dungeon_boss_template_id`, `dominated_by_id`, `spawn_x`, `spawn_y`, `is_active`.
  * **5 Malhas Poligonais Editáveis:** `collision_mesh_json`, `overlap_mesh_json` (`overlap_opacity`), `building_mesh_json`, `plantation_mesh_json` e `fishing_mesh_json`.
* **`dungeon_runs` (`DungeonRun`):** Controle diário 1x/dia (`entry_date` `YYYY-MM-DD`, `status`, `battle_id`, `return_map_id/x/y`). Índices: `@@unique([characterId, dungeonMapId, entryDate])`, `@@index([characterId, entryDate])`.
* **`dungeon_chest_configs` (`DungeonChestConfig`):** Baús de recompensa pós-Dungeon (`COMMON` 75%, `EPIC` 20%, `LEGENDARY` 5%) com escala, offsets, brilho, faixas ponderadas de Ouro/XP e lista de drops de itens.
* **`map_portals` (`MapPortal`):** Duplas bidirecionais de teleporte (`source_map_id`, `source_x/y`, `trigger_radius`, `linked_portal_id`, `target_map_id`, `target_x/y`, `portal_vfx_key`). Índice: `@@index([sourceMapId])`.
* **`shop_templates` (`ShopTemplate`):** Catálogo modular de lojas (`code`, `name_pt_br`, `description_pt_br`, `catalog_json`, `is_active`) vinculável a qualquer NPC.
* **`npc_templates` (`NpcTemplate`):** Catálogo curado de NPCs (`mcrework_npc_key`, `name_i18n_key`, `is_decoration_only`, `roles_json`, `shop_template_id`, `triggers_json`).
* **`map_npcs` (`MapNpc`):** Posicionamento de NPCs nos mapas com destinos configuráveis de teleporte (`teleport_destinations_json`). Índice: `@@index([mapId])`.
* **`world_map_templates` (`WorldMapTemplate`):** Mapas gerais dos continentes com arte limpa, logotipo reposicionável, camadas de rotas e pontos vinculados a `GameMap`.

---

## 3. Bloco C — Elementos (5), Raças (11), Atributos Procedurais & Monstros

* **`elements` (`Element`) & `element_matchups` (`ElementMatchup`):** `FIRE`, `EARTH`, `AIR`, `WATER`, `NEUTRAL` (`±25%` ciclo ativo; `NEUTRAL` `-25%` causado e `+25%` recebido).
* **`races` (`Race`) & `race_matchups` (`RaceMatchup`):** `HUMAN` (`+10%` sobre todas) + ciclo das 10 raças (`PLANT > DRAGON > REPTILIAN > AQUATIC > ROBOTIC > CELESTIAL > DEMON > FAIRY > SPIRIT > BEAST > PLANT`, `+10%`).
* **`base_attributes` (`BaseAttribute`):** `VIT`, `STR`, `INT`, `WIS`, `AGI`, `DEX`.
* **`combat_attributes` (`CombatAttribute`) & `attribute_conversions` (`AttributeConversion`):** Matriz low-code que converte cada Atributo Base em atributos de combate (`MAX_HP`, `MAX_MP`, `PHYS_ATK`, `MAG_ATK`, `PHYS_DEF`, `MAG_DEF`, `SPEED`, `BATTLE_MOVE_SPEED`, `ATTACK_SPEED`, `CRIT_RATE`, `CRIT_DAMAGE_PCT`, `PHYS_ACCURACY`, `MAG_ACCURACY`, `PHYS_EVASION`, `MAG_EVASION`, etc.).
* **`monster_global_configs` (`MonsterGlobalConfig`):** Configuração global única editável em `/admin` contendo escalonamento de nível, variação `min/max`, recompensas base por nível, limites de encontro, penalidades de desnível, `variant_configs_json` (`NORMAL`/`LEADER`/`BOSS`), `rank_configs_json` (`F..SS`) e multiplicadores de Dungeon.
* **`monster_rarities` (`MonsterRarity`):** Tabela histórica preservada para compatibilidade de schema/snapshot.
* **`hunter_pet_cost_rules` (`HunterPetCostRule`):** Custos de Essências/Ouro para invocar Pets e recompensas de venda por raridade (`F`..`SS`).
* **`monster_templates` (`MonsterTemplate`) & `monster_biomes` (`MonsterBiome`):** Templates de monstros/pets com `rarity_tier` (`F`..`SS`), `race_code`, `fixed_element_code`, `combat_style` (`MELEE`/`RANGED`), `attack_range`, `damage_type`, `base_attributes_json`, `base_combat_attributes_json`, `skill_ids_json`, `loot_table_json` e vínculo `@@index([biomeId])`.

---

## 4. Bloco D — Classes, Habilidades, Buffs, Equipamentos, Conjuntos & Itens

* **`class_templates` (`ClassTemplate`):** Arquétipos jogáveis (`code`, `mcrework_char_key`, `reborn_mcrework_char_key`, offsets visuais/sombra padrão e reborn, `combat_style`, `attack_range`, `damage_type`, `base_attributes_json`, `growth_per_level_json`, `base_combat_attributes_json`, `skill_ids_json`).
* **`skill_templates` (`SkillTemplate`):** Habilidades Ativas e Passivas em tempo real (`cast_action_id`, `cast_movement`, `mcrework_vfx_key`, `vfx_color_hex`, `cooldown_seconds`, `cast_range`, `aoe_radius`, `cone_angle_deg`, `line_width_px`, `ground_zone_duration_sec`, `ignore_evasion`, `target_scope`, `effect_blocks_json`, além de campos legados `ap_cost`/`cooldown_turns` mantidos por Cláusula 0.2).
* **`status_effect_templates` (`StatusEffectTemplate`):** Buffs, Debuffs, DoT/HoT e Controles de Grupo (`status_category`, `break_on_damage`, `trigger_type`, `duration_seconds`, `tick_interval_seconds`, `stat_modifiers_json`, `dot_hot_formula_json`, `control_flags_json`).
* **`equipment_slots` (`EquipmentSlot`):** 16 slots de personagem (`SHOULDER`, `HEAD`, `CHEST`, `BELT`, `LEGS`, `FEET`, `ORNAMENT_1`, `ORNAMENT_2`, `RING`, `NECKLACE`, `WEAPON_1`, `WEAPON_2`, `FISHING_ROD`, `FLYING_MOUNT`, `WINGS`, `FASHION`) + 6 slots de Pet (`PET_EQUIP_1..6`). Todas as montarias voadoras e asas são unificadas em `item_templates` com `equipment_slot_code` = `FLYING_MOUNT` ou `WINGS`.
* **`equipment_sets` (`EquipmentSet`):** Conjuntos com regra canônica de bônus `50%` (6 peças → 40% dos stats) e `100%` (12 peças → 100% dos stats).
* **`item_templates` (`ItemTemplate`):** Catálogo unificado de equipamentos, itens de pet, asas/montarias, varas de pesca (`FISHING_ROD`), peixes (`FISH`), iscas (`FISHING_BAIT`), consumíveis, trocadores de elemento, baús/roletas (`OPEN_CHEST`/`ROULETTE`), materiais e missões (`@@index([itemCategory])`, `@@index([equipmentSlotCode])`).

---

## 5. Bloco E — Contas, Personagens, Inventário, Pets, Quests, Progressão & UI

* **`user_accounts` (`UserAccount`):** Contas (`PLAYER`, `GM`, `ADMIN`, `DEV`), RBAC granular por tabela (`table_permissions_json`) e preferência persistente de idioma (`locale`, padrão `"pt-BR"`, atualizável pelo jogador em `POST /api/play/locale`).
* **`player_characters` (`PlayerCharacter`):** Heróis dos jogadores com elemento sorteado, `level`, `experience` (`BigInt`), `gold` (`BigInt`), `unspent_stat_points`, `distributed_stats_json`, `equipped_items_json` (16 slots), posição atual (`current_map_id`, `pos_x`, `pos_y`), `is_criminal`, `is_reborn`, `is_flying`. Índices: `@@index([userAccountId])`, `@@index([currentMapId])`.
* **`character_inventory_items` (`CharacterInventoryItem`):** Mochila em grade de 300 slots (`@@unique([characterId, slotIndex])`, `@@index([characterId, itemTemplateId])`) com stack de até 999 ou 1 para itens únicos, suporte completo a split, auto-sort, equip/unequip, abertura de contêineres e compras/vendas em lojas.
* **`character_pets` (`CharacterPet`):** Pets domados com 76 pontos livres iniciais no Nv.1 + 4 pontos/nível, 3 skills, formação `deploy_slot` (`1..3` solo, `1` em party) e 6 slots de equipamento (`PET_EQUIP_1..6`). Índices: `@@index([characterId])`, `@@index([characterId, deploySlot])`.
* **`arena_formations` (`ArenaFormation`):** Tabela histórica preservada para compatibilidade de schema/snapshot.
* **`quest_templates` (`QuestTemplate`) & `character_quest_progress` (`CharacterQuestProgress`):** Missões `MAIN`, `SIDE`, `EPIC`, `PROFICIENCY` e `META` procedurais (estágios cumulativos `current_stage`, objetivos por etapa, batalhas de quest, escolha de pet inicial e coeficientes de XP/Ouro).
* **`level_experience_templates` (`LevelExperienceTemplate`):** Curva procedural de XP, bônus base HP/MP e brackets por 10 níveis (Nv. `1..100+`).
* **`client_ui_layout_templates` (`ClientUiLayoutTemplate`):** Layout camaleão configurável por dispositivo (`mobile_portrait_json`, `mobile_landscape_json`, `desktop_json`) para HUDs, modais e controles em `/play`.

---

## 6. Persistência PostgreSQL + Snapshots JSON Atômicos

* **PostgreSQL:** Banco oficial único em desenvolvimento (Docker no WSL2) e produção (PostgreSQL local na VPS Azure).
* **`SnapshotManager` (`packages/database/src/SnapshotManager.ts`):** Exporta automaticamente toda edição do `/admin` usando fila mutex coalesce (`exportInFlight`/`exportQueued`), leitura paralela em 3 lotes `Promise.all` e substituição atômica via `.tmp` + `rename` em `packages/database/snapshots/lowcode.snapshot.json`.
* Ao restaurar ou subir ambiente novo (`npm run db:snapshot:restore`), todas as tabelas curadas e sequências PostgreSQL são sincronizadas sem perda de dados.
