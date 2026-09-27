import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// `user` is a reserved word in Postgres.
@Entity({ name: 'app_user' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Stored normalised (trimmed, lower-case), so the unique constraint is case-insensitive.
  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text', nullable: true })
  displayName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
