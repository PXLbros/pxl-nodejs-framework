import { ApplicationConfig, ApplicationWebServerConfig, ApplicationWebSocketConfig } from './base-application.interface.js';
import WebApplication from './web-application.js';

export interface WebApplicationEventsConfig {
  onStarted?: ({ app, startupTime }: { app: WebApplication; startupTime: number }) => void;
  onStopped?: ({ app, runtime }: { app: WebApplication; runtime: number }) => void;
}

export interface WebApplicationConfig extends ApplicationConfig {
  /** WebSocket configuration */
  webSocket?: ApplicationWebSocketConfig;

  /** Web server configuration */
  webServer?: ApplicationWebServerConfig;

  /** Web server events */
  events?: WebApplicationEventsConfig;
}
