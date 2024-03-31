import { EntityManager, MikroORM } from '@mikro-orm/postgresql';

export interface DatabaseInstanceConstructorParams {
  orm: MikroORM;
}
