import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { ModelVersion } from './model-version.entity.js';

@Entity()
@Unique(['modelVersionId', 'className'])
@Check(`"class_id" >= 0`)
export class ModelClass {
  @PrimaryColumn({ type: 'text' })
  modelVersionId!: string;

  @PrimaryColumn({ type: 'integer' })
  classId!: number;

  @ManyToOne(() => ModelVersion, (modelVersion) => modelVersion.classes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  modelVersion!: Relation<ModelVersion>;

  @Column({ type: 'text' })
  className!: string;
}
