import { ApplicationConfig } from '../application/base-application.interface.js';

export interface ApplicationDatabaseOptions {
  /** Application config */
  applicationConfig: ApplicationConfig;

  /** Database host */
  host: string;

  /** Database port */
  port: number;

  /** Database username */
  username: string;

  /** Database password */
  password: string;

  /** Database name */
  databaseName: string;

  /** Entities directory */
  entitiesDirectory: string;
}
