import { ApplicationConfig, ApplicationWebServerConfig, ApplicationWebSocketConfig } from './base-application.interface.js';

export interface WebApplicationConfig extends ApplicationConfig {
  /** WebSocket configuration */
  webSocket?: ApplicationWebSocketConfig;

  /** Web server configuration */
  webServer?: ApplicationWebServerConfig;
}
