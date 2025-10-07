import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { z } from 'zod';
import { DynamicEntity } from '../../../../../src/database/dynamic-entity.js';
// buildEntitySchemas not needed directly; using DynamicEntity.configureSchemas

/**
 * Greeting Entity
 * Simple entity to demonstrate database functionality
 */
@Entity()
export class Greeting extends DynamicEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  message!: string;

  // Optional metadata fields to demonstrate optional create vs update differences
  @Property({ nullable: true })
  language?: string;

  @Property({ nullable: true })
  tags?: string[];

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  static {
    this.defineSchemas({
      shape: {
        name: z.string().min(1),
        message: z.string().min(1),
        language: z.string().min(2).max(10).optional(),
        tags: z.array(z.string().min(1)).max(10).optional(),
      },
      updatableFields: ['message', 'language', 'tags'] as const,
    });
  }
}
