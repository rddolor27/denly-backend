import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { DETECTION_SOURCE_DEVICE } from '../constants/scans.constants.js';
import { Scan } from './scan.entity.js';

// Device-reported and registry-checked; never treated as more than what the app said it saw.
@Entity()
@Unique(['scanId', 'position'])
@Check(`"confidence" >= 0 AND "confidence" <= 1`)
@Check(`"x1" >= 0 AND "x1" < "x2" AND "x2" <= 1`)
@Check(`"y1" >= 0 AND "y1" < "y2" AND "y2" <= 1`)
export class Detection {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  scanId!: string;

  @ManyToOne(() => Scan, (scan) => scan.detections, { onDelete: 'CASCADE' })
  @JoinColumn()
  scan!: Relation<Scan>;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ type: 'text' })
  modelVersionId!: string;

  @Column({ type: 'integer' })
  classId!: number;

  @Column({ type: 'text' })
  className!: string;

  @Column({ type: 'double precision' })
  x1!: number;

  @Column({ type: 'double precision' })
  y1!: number;

  @Column({ type: 'double precision' })
  x2!: number;

  @Column({ type: 'double precision' })
  y2!: number;

  @Column({ type: 'double precision' })
  confidence!: number;

  @Column({ type: 'text', default: DETECTION_SOURCE_DEVICE })
  source!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
