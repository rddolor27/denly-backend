import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersAndRefreshTokens1790171843379 implements MigrationInterface {
  name = 'AddUsersAndRefreshTokens1790171843379';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "app_user" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" text NOT NULL, "password_hash" text NOT NULL, "display_name" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3fa909d0e37c531ebc237703391" UNIQUE ("email"), CONSTRAINT "PK_22a5c4a3d9b2fb8e4e73fc4ada1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f0812282fad2e352cdaf83ef0a9" UNIQUE ("token_hash"), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbe63d2fe75e7f0ba1710351d" ON "refresh_token"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eb31f2a7917404a46e17f539f1" ON "refresh_token"  ("family_id") `,
    );
    // Scans require a signed-in owner from here on; ownerless rows cannot be backfilled, so this fails on a non-empty scan table.
    await queryRunner.query(`ALTER TABLE "scan" ADD "user_id" uuid NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "scan" ALTER COLUMN "created_at" TYPE TIMESTAMP(3) WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d76f9ba63a3e257bdd55236f1" ON "scan"  ("user_id", "created_at", "id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan" ADD CONSTRAINT "FK_6c0a024e7bd84a2c69bd49ad3fd" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scan" DROP CONSTRAINT "FK_6c0a024e7bd84a2c69bd49ad3fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d76f9ba63a3e257bdd55236f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan" ALTER COLUMN "created_at" TYPE TIMESTAMP(6) WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "scan" DROP COLUMN "user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eb31f2a7917404a46e17f539f1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bbe63d2fe75e7f0ba1710351d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_token"`);
    await queryRunner.query(`DROP TABLE "app_user"`);
  }
}
