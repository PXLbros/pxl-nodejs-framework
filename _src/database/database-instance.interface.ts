import { MikroORM } from '@mikro-orm/postgresql';

export interface DatabaseInstanceProps {
  orm: MikroORM;
}
