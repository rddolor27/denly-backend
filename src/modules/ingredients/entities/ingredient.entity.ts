import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import type { IngredientMetadata } from '../models/ingredient-metadata.js';
import { IngredientAlias } from './ingredient-alias.entity.js';

@Entity()
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', unique: true })
  canonicalName!: string;

  @Index()
  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: IngredientMetadata;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  dietaryFlags!: string[];

  @OneToMany(() => IngredientAlias, (alias) => alias.ingredient)
  aliases!: Relation<IngredientAlias[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
