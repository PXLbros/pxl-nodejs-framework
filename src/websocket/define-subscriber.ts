import type {
  WebSocketSubscriberDefinition,
  WebSocketSubscriberHandler,
  WebSocketSubscriberHandlerContext,
  WebSocketSubscriberMatcher,
} from './websocket.interface.js';

type ChannelConfig = {
  channel: string;
  channels?: never;
  match?: never;
};

type ChannelsConfig = {
  channels: string[];
  channel?: never;
  match?: never;
};

type MatchConfig = {
  match: WebSocketSubscriberMatcher | WebSocketSubscriberMatcher[];
  channel?: never;
  channels?: never;
};

type MiddlewareConfig = Array<{
  name: string;
  onBefore?: (context: WebSocketSubscriberHandlerContext) => boolean | Promise<boolean>;
  onAfter?: (context: WebSocketSubscriberHandlerContext, result: unknown) => void | Promise<void>;
  onError?: (context: WebSocketSubscriberHandlerContext, error: Error) => boolean | Promise<boolean>;
}>;

type BaseConfig = {
  name?: string;
  description?: string;
  priority?: number;
  middleware?: MiddlewareConfig;
  handle: WebSocketSubscriberHandler;
};

export type DefineWebSocketSubscriberConfig = BaseConfig & (ChannelConfig | ChannelsConfig | MatchConfig);

export function defineWebSocketSubscriber(config: DefineWebSocketSubscriberConfig): WebSocketSubscriberDefinition {
  let matchers: WebSocketSubscriberMatcher[] = [];
  if ('match' in config) {
    const matchConfig = config as MatchConfig & BaseConfig;
    matchers = Array.isArray(matchConfig.match) ? [...matchConfig.match] : [matchConfig.match];
  }

  let channels: string[] = [];
  if ('channel' in config) {
    const channelConfig = config as ChannelConfig & BaseConfig;
    channels = [channelConfig.channel];
  } else if ('channels' in config) {
    const channelsConfig = config as ChannelsConfig & BaseConfig;
    channels = [...channelsConfig.channels];
  }

  if (channels.length === 0 && matchers.length === 0) {
    throw new Error('defineWebSocketSubscriber requires either channel(s) or a match function.');
  }

  return {
    name: config.name,
    description: config.description,
    priority: config.priority,
    channels,
    matchers,
    handle: config.handle,
    middleware: config.middleware,
  };
}
