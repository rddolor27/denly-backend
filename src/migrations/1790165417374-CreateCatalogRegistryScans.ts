import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogRegistryScans1790165417374 implements MigrationInterface {
  name = 'CreateCatalogRegistryScans1790165417374';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ingredient" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slug" text NOT NULL, "canonical_name" text NOT NULL, "category" text NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "dietary_flags" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_92c3338c696827432934924b37d" UNIQUE ("slug"), CONSTRAINT "UQ_3bced194fb004b7910e3fa09f4e" UNIQUE ("canonical_name"), CONSTRAINT "PK_6f1e945604a0b59f56a57570e98" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae7ceb3b3e2328ebee10ae5c1c" ON "ingredient"  ("category") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alias_source" AS ENUM('model_class', 'synonym', 'regional', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ingredient_alias" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ingredient_id" uuid NOT NULL, "alias" text NOT NULL, "alias_normalized" text NOT NULL, "source" "public"."alias_source" NOT NULL, "locale" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_67acc48095a69839a342cfe974f" UNIQUE ("alias_normalized"), CONSTRAINT "PK_1a484d243d08e21007895e6259b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ced69e2f957fd9f2bc7dc8c1c6" ON "ingredient_alias"  ("ingredient_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."model_version_status" AS ENUM('supported', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "model_version" ("id" text NOT NULL, "status" "public"."model_version_status" NOT NULL DEFAULT 'supported', "taxonomy_version" text, "classes_sha256" text NOT NULL, "class_count" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1213bca4e8ee7ac1323cc4bf454" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f483b769151562b04f5bd426c2" ON "model_version"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "model_class" ("model_version_id" text NOT NULL, "class_id" integer NOT NULL, "class_name" text NOT NULL, CONSTRAINT "UQ_bfff0a69539258e5c80a1f31565" UNIQUE ("model_version_id", "class_name"), CONSTRAINT "CHK_468f66011a344f4168eccb42b1" CHECK ("class_id" >= 0), CONSTRAINT "PK_40e2462bc4b6791840f3a4e8fcd" PRIMARY KEY ("model_version_id", "class_id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."scan_analysis_status" AS ENUM('pending', 'done', 'unavailable')`,
    );
    await queryRunner.query(
      `CREATE TABLE "scan" ("id" uuid NOT NULL, "model_version_id" text NOT NULL, "image_width" integer NOT NULL, "image_height" integer NOT NULL, "latency_ms" integer NOT NULL, "rules_version" text NOT NULL, "prompt_version" text, "result" jsonb NOT NULL, "analysis_status" "public"."scan_analysis_status" NOT NULL, "analysis" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_b1f98f3cb1158ebc87ba19b035" CHECK ("latency_ms" >= 0), CONSTRAINT "CHK_84f8801f54a18e6432cef6ef44" CHECK ("image_width" > 0 AND "image_height" > 0), CONSTRAINT "PK_9868a638d0569ba3fe3bddcef84" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ba4480795827ff2c8085cb770" ON "scan"  ("model_version_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3536e0bf57575fd768985a421e" ON "scan"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "detection" ("id" uuid NOT NULL, "scan_id" uuid NOT NULL, "position" integer NOT NULL, "model_version_id" text NOT NULL, "class_id" integer NOT NULL, "class_name" text NOT NULL, "x1" double precision NOT NULL, "y1" double precision NOT NULL, "x2" double precision NOT NULL, "y2" double precision NOT NULL, "confidence" double precision NOT NULL, "source" text NOT NULL DEFAULT 'device', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6ad3fb44301bbcee626c81670a6" UNIQUE ("scan_id", "position"), CONSTRAINT "CHK_ebc28ccc0b7fc2628557c66952" CHECK ("y1" >= 0 AND "y1" < "y2" AND "y2" <= 1), CONSTRAINT "CHK_9e44e74d99bf7c6e188fe1ea8d" CHECK ("x1" >= 0 AND "x1" < "x2" AND "x2" <= 1), CONSTRAINT "CHK_a8ab59beafb40f757bd53a64f2" CHECK ("confidence" >= 0 AND "confidence" <= 1), CONSTRAINT "PK_a4cf3d8ecd3e2802294110f9705" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_alias" ADD CONSTRAINT "FK_ced69e2f957fd9f2bc7dc8c1c6f" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_class" ADD CONSTRAINT "FK_c2dc379af43b5bb612239f80ea7" FOREIGN KEY ("model_version_id") REFERENCES "model_version"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan" ADD CONSTRAINT "FK_4ba4480795827ff2c8085cb7704" FOREIGN KEY ("model_version_id") REFERENCES "model_version"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "detection" ADD CONSTRAINT "FK_33493bc02a948447548ed1d320f" FOREIGN KEY ("scan_id") REFERENCES "scan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "detection" DROP CONSTRAINT "FK_33493bc02a948447548ed1d320f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan" DROP CONSTRAINT "FK_4ba4480795827ff2c8085cb7704"`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_class" DROP CONSTRAINT "FK_c2dc379af43b5bb612239f80ea7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_alias" DROP CONSTRAINT "FK_ced69e2f957fd9f2bc7dc8c1c6f"`,
    );
    await queryRunner.query(`DROP TABLE "detection"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3536e0bf57575fd768985a421e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4ba4480795827ff2c8085cb770"`,
    );
    await queryRunner.query(`DROP TABLE "scan"`);
    await queryRunner.query(`DROP TYPE "public"."scan_analysis_status"`);
    await queryRunner.query(`DROP TABLE "model_class"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f483b769151562b04f5bd426c2"`,
    );
    await queryRunner.query(`DROP TABLE "model_version"`);
    await queryRunner.query(`DROP TYPE "public"."model_version_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ced69e2f957fd9f2bc7dc8c1c6"`,
    );
    await queryRunner.query(`DROP TABLE "ingredient_alias"`);
    await queryRunner.query(`DROP TYPE "public"."alias_source"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae7ceb3b3e2328ebee10ae5c1c"`,
    );
    await queryRunner.query(`DROP TABLE "ingredient"`);
  }
}
