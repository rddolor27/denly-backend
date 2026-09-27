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
import { User } from '@/modules/users/entities/user.entity.js';

// Opaque rotating refresh tokens; only the SHA-256 of the token is stored. A family is one
// sign-in; presenting an already-rotated token revokes the whole family (reuse detection).
@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  familyId!: string;

  @Column({ type: 'text', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
