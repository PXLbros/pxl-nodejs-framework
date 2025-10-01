import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Greeting Entity
 * Simple entity to demonstrate database functionality
 */
@Entity()
export class Greeting {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  message!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
