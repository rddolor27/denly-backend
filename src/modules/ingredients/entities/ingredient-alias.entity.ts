import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { AliasSource } from '../constants/ingredients.constants.js';
import { Ingredient } from './ingredient.entity.js';

@Entity()
export class IngredientAlias {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  ingredientId!: string;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.aliases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  ingredient!: Relation<Ingredient>;

  @Column({ type: 'text' })
  alias!: string;

  // One normalised alias maps to exactly one ingredient; ambiguity is resolved in the data.
  @Column({ type: 'text', unique: true })
  aliasNormalized!: string;

  @Column({ type: 'enum', enum: AliasSource, enumName: 'alias_source' })
  source!: AliasSource;

  @Column({ type: 'text', nullable: true })
  locale!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
