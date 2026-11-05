-- CreateTable
CREATE TABLE "i18n_translations" (
    "id" SERIAL NOT NULL,
    "i18n_key" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "i18n_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biomes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "description_i18n_key" TEXT NOT NULL,

    CONSTRAINT "biomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "domination_target" TEXT NOT NULL,
    "allow_monster_spawn" BOOLEAN NOT NULL DEFAULT false,
    "pvp_rule" TEXT NOT NULL,
    "forces_criminal_status" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "map_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maps" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "mcrework_map_image" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "required_level" INTEGER NOT NULL DEFAULT 1,
    "level_variance_min" INTEGER NOT NULL DEFAULT -2,
    "level_variance_max" INTEGER NOT NULL DEFAULT 5,
    "map_type_id" INTEGER NOT NULL,
    "primary_biome_id" INTEGER NOT NULL,
    "secondary_biome_id" INTEGER NOT NULL,
    "dominated_by_id" TEXT,
    "spawn_x" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "spawn_y" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "collision_mesh_json" JSONB NOT NULL DEFAULT '[]',
    "overlap_mesh_json" JSONB NOT NULL DEFAULT '[]',
    "overlap_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_portals" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Portal',
    "source_map_id" INTEGER NOT NULL,
    "source_x" DOUBLE PRECISION NOT NULL,
    "source_y" DOUBLE PRECISION NOT NULL,
    "trigger_radius" DOUBLE PRECISION NOT NULL DEFAULT 48,
    "linked_portal_id" INTEGER,
    "target_map_id" INTEGER,
    "target_x" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "target_y" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "portal_vfx_key" TEXT,

    CONSTRAINT "map_portals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "npc_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "mcrework_npc_key" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "is_decoration_only" BOOLEAN NOT NULL DEFAULT false,
    "triggers_json" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "npc_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_npcs" (
    "id" SERIAL NOT NULL,
    "map_id" INTEGER NOT NULL,
    "npc_template_id" INTEGER NOT NULL,
    "pos_x" DOUBLE PRECISION NOT NULL,
    "pos_y" DOUBLE PRECISION NOT NULL,
    "direction" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "map_npcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elements" (
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "initial_roll_chance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "elements_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "element_matchups" (
    "id" SERIAL NOT NULL,
    "attacker_element_code" TEXT NOT NULL,
    "defender_element_code" TEXT NOT NULL,
    "damage_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "element_matchups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "races" (
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "race_matchups" (
    "id" SERIAL NOT NULL,
    "attacker_race_code" TEXT NOT NULL,
    "defender_race_code" TEXT NOT NULL,
    "damage_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "race_matchups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_attributes" (
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "description_i18n_key" TEXT NOT NULL,

    CONSTRAINT "base_attributes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "combat_attributes" (
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "base_default" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_percentage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "combat_attributes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "attribute_conversions" (
    "id" SERIAL NOT NULL,
    "base_attribute_code" TEXT NOT NULL,
    "combat_attribute_code" TEXT NOT NULL,
    "ratio_per_point" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "attribute_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "mcrework_char_key" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "race_code" TEXT NOT NULL DEFAULT 'HUMAN',
    "base_attributes_json" JSONB NOT NULL,
    "growth_per_level_json" JSONB NOT NULL,
    "skill_ids_json" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monster_rarities" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "stat_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "exp_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "drop_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "visual_scale_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "spawn_weight" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "monster_rarities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monster_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "mcrework_monster_key" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "race_code" TEXT NOT NULL,
    "fixed_element_code" TEXT NOT NULL,
    "default_rarity_id" INTEGER NOT NULL,
    "is_tamable_as_pet" BOOLEAN NOT NULL DEFAULT true,
    "base_attributes_json" JSONB NOT NULL,
    "skill_ids_json" JSONB NOT NULL DEFAULT '[]',
    "loot_table_json" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "monster_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monster_biomes" (
    "id" SERIAL NOT NULL,
    "monster_template_id" INTEGER NOT NULL,
    "biome_id" INTEGER NOT NULL,

    CONSTRAINT "monster_biomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "description_i18n_key" TEXT NOT NULL,
    "mcrework_icon_key" TEXT,
    "cast_action_id" INTEGER NOT NULL DEFAULT 4,
    "mcrework_vfx_key" TEXT,
    "skill_type" TEXT NOT NULL DEFAULT 'ACTIVE',
    "trigger_type" TEXT NOT NULL DEFAULT 'MANUAL_AP',
    "ap_cost" INTEGER NOT NULL DEFAULT 2,
    "cooldown_turns" INTEGER NOT NULL DEFAULT 0,
    "target_scope" TEXT NOT NULL DEFAULT 'MELEE_FRONTLINE',
    "effect_blocks_json" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "skill_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_effect_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "icon_key" TEXT,
    "is_buff" BOOLEAN NOT NULL DEFAULT true,
    "max_stacks" INTEGER NOT NULL DEFAULT 1,
    "default_duration_turns" INTEGER NOT NULL DEFAULT 2,
    "stat_modifiers_json" JSONB NOT NULL DEFAULT '{}',
    "dot_hot_formula_json" JSONB NOT NULL DEFAULT '{}',
    "control_flags_json" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "status_effect_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_slots" (
    "code" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "name_i18n_key" TEXT NOT NULL,

    CONSTRAINT "equipment_slots_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "item_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_i18n_key" TEXT NOT NULL,
    "description_i18n_key" TEXT NOT NULL,
    "mcrework_icon_key" TEXT,
    "item_category" TEXT NOT NULL,
    "equipment_slot_code" TEXT,
    "required_level" INTEGER NOT NULL DEFAULT 1,
    "base_stat_bonuses_json" JSONB NOT NULL DEFAULT '{}',
    "combat_stat_bonuses_json" JSONB NOT NULL DEFAULT '{}',
    "special_effect_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "item_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_characters" (
    "id" SERIAL NOT NULL,
    "user_account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "class_template_id" INTEGER NOT NULL,
    "element_code" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" BIGINT NOT NULL DEFAULT 0,
    "unspent_stat_points" INTEGER NOT NULL DEFAULT 0,
    "distributed_stats_json" JSONB NOT NULL DEFAULT '{"VIT":0,"STR":0,"INT":0,"WIS":0,"AGI":0,"DEX":0}',
    "equipped_items_json" JSONB NOT NULL DEFAULT '{}',
    "current_map_id" INTEGER,
    "pos_x" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "pos_y" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "is_criminal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_pets" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "monster_template_id" INTEGER NOT NULL,
    "nickname" TEXT,
    "element_code" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" BIGINT NOT NULL DEFAULT 0,
    "equipped_items_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "character_pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_formations" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "slots_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "arena_formations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "i18n_translations_i18n_key_idx" ON "i18n_translations"("i18n_key");

-- CreateIndex
CREATE UNIQUE INDEX "i18n_translations_i18n_key_locale_key" ON "i18n_translations"("i18n_key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "biomes_code_key" ON "biomes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "map_types_code_key" ON "map_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "maps_code_key" ON "maps"("code");

-- CreateIndex
CREATE UNIQUE INDEX "npc_templates_code_key" ON "npc_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "element_matchups_attacker_element_code_defender_element_cod_key" ON "element_matchups"("attacker_element_code", "defender_element_code");

-- CreateIndex
CREATE UNIQUE INDEX "race_matchups_attacker_race_code_defender_race_code_key" ON "race_matchups"("attacker_race_code", "defender_race_code");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_conversions_base_attribute_code_combat_attribute__key" ON "attribute_conversions"("base_attribute_code", "combat_attribute_code");

-- CreateIndex
CREATE UNIQUE INDEX "class_templates_code_key" ON "class_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "monster_rarities_code_key" ON "monster_rarities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "monster_templates_code_key" ON "monster_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "monster_biomes_monster_template_id_biome_id_key" ON "monster_biomes"("monster_template_id", "biome_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_templates_code_key" ON "skill_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "status_effect_templates_code_key" ON "status_effect_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "item_templates_code_key" ON "item_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_username_key" ON "user_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "player_characters_name_key" ON "player_characters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "arena_formations_character_id_key" ON "arena_formations"("character_id");

-- AddForeignKey
ALTER TABLE "maps" ADD CONSTRAINT "maps_map_type_id_fkey" FOREIGN KEY ("map_type_id") REFERENCES "map_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maps" ADD CONSTRAINT "maps_primary_biome_id_fkey" FOREIGN KEY ("primary_biome_id") REFERENCES "biomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maps" ADD CONSTRAINT "maps_secondary_biome_id_fkey" FOREIGN KEY ("secondary_biome_id") REFERENCES "biomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_portals" ADD CONSTRAINT "map_portals_source_map_id_fkey" FOREIGN KEY ("source_map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_portals" ADD CONSTRAINT "map_portals_target_map_id_fkey" FOREIGN KEY ("target_map_id") REFERENCES "maps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_npcs" ADD CONSTRAINT "map_npcs_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_npcs" ADD CONSTRAINT "map_npcs_npc_template_id_fkey" FOREIGN KEY ("npc_template_id") REFERENCES "npc_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_matchups" ADD CONSTRAINT "element_matchups_attacker_element_code_fkey" FOREIGN KEY ("attacker_element_code") REFERENCES "elements"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_matchups" ADD CONSTRAINT "element_matchups_defender_element_code_fkey" FOREIGN KEY ("defender_element_code") REFERENCES "elements"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_matchups" ADD CONSTRAINT "race_matchups_attacker_race_code_fkey" FOREIGN KEY ("attacker_race_code") REFERENCES "races"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_matchups" ADD CONSTRAINT "race_matchups_defender_race_code_fkey" FOREIGN KEY ("defender_race_code") REFERENCES "races"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_conversions" ADD CONSTRAINT "attribute_conversions_base_attribute_code_fkey" FOREIGN KEY ("base_attribute_code") REFERENCES "base_attributes"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_conversions" ADD CONSTRAINT "attribute_conversions_combat_attribute_code_fkey" FOREIGN KEY ("combat_attribute_code") REFERENCES "combat_attributes"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_race_code_fkey" FOREIGN KEY ("race_code") REFERENCES "races"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_templates" ADD CONSTRAINT "monster_templates_race_code_fkey" FOREIGN KEY ("race_code") REFERENCES "races"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_templates" ADD CONSTRAINT "monster_templates_fixed_element_code_fkey" FOREIGN KEY ("fixed_element_code") REFERENCES "elements"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_templates" ADD CONSTRAINT "monster_templates_default_rarity_id_fkey" FOREIGN KEY ("default_rarity_id") REFERENCES "monster_rarities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_biomes" ADD CONSTRAINT "monster_biomes_monster_template_id_fkey" FOREIGN KEY ("monster_template_id") REFERENCES "monster_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_biomes" ADD CONSTRAINT "monster_biomes_biome_id_fkey" FOREIGN KEY ("biome_id") REFERENCES "biomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_templates" ADD CONSTRAINT "item_templates_equipment_slot_code_fkey" FOREIGN KEY ("equipment_slot_code") REFERENCES "equipment_slots"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_characters" ADD CONSTRAINT "player_characters_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_characters" ADD CONSTRAINT "player_characters_class_template_id_fkey" FOREIGN KEY ("class_template_id") REFERENCES "class_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_pets" ADD CONSTRAINT "character_pets_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_pets" ADD CONSTRAINT "character_pets_monster_template_id_fkey" FOREIGN KEY ("monster_template_id") REFERENCES "monster_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_formations" ADD CONSTRAINT "arena_formations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

