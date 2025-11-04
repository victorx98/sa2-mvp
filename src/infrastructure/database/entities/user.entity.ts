import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'cn_nickname' })
  cnNickname: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_time' })
  createdTime: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'modified_time' })
  modifiedTime: Date;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'created_by' })
  createdBy: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'updated_by' })
  updatedBy: string;
}
