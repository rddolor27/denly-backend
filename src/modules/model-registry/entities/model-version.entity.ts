import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ModelVersionStatus } from '../constants/model-registry.constants.js';
import { ModelClass } from './model-class.entity.js';

@Entity()
export class ModelVersion {
  // e.g. `yolov8n-ingredients-0.1.0` — the string the app reports in every DetectionRun.
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ModelVersionStatus,
    enumName: 'model_version_status',
    default: ModelVersionStatus.SUPPORTED,
  })
  status!: ModelVersionStatus;

  @Column({ type: 'text', nullable: true })
  taxonomyVersion!: string | null;

  @Column({ type: 'text' })
  classesSha256!: string;

  @Column({ type: 'integer' })
  classCount!: number;

  @OneToMany(() => ModelClass, (modelClass) => modelClass.modelVersion)
  classes!: Relation<ModelClass[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
