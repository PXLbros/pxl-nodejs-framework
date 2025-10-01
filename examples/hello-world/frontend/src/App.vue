<template>
  <div class="app">
    <header class="header">
      <h1>PXL Framework</h1>
      <p class="subtitle">Hello World Example</p>
    </header>

    <main class="main">
      <!-- Ping Test -->
      <section class="card">
        <h2>API Health Check</h2>
        <p>Test the /api/ping endpoint</p>
        <button @click="handlePing" :disabled="loading" class="button">
          {{ loading ? 'Pinging...' : 'Ping API' }}
        </button>
        <div v-if="pingResult" class="result success">
          <strong>Response:</strong>
          <pre>{{ JSON.stringify(pingResult, null, 2) }}</pre>
        </div>
        <div v-if="pingError" class="result error"><strong>Error:</strong> {{ pingError }}</div>
      </section>

      <!-- Hello Endpoint -->
      <section class="card">
        <h2>Greeting Endpoint</h2>
        <p>Test the /api/hello endpoint with a custom name</p>
        <div class="form-group">
          <label for="name">Your Name:</label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Enter your name"
            class="input"
            @keyup.enter="handleHello"
          />
        </div>
        <button @click="handleHello" :disabled="loading || !name" class="button">
          {{ loading ? 'Sending...' : 'Say Hello' }}
        </button>
        <div v-if="helloResult" class="result success">
          <strong>Response:</strong>
          <pre>{{ JSON.stringify(helloResult, null, 2) }}</pre>
        </div>
        <div v-if="helloError" class="result error"><strong>Error:</strong> {{ helloError }}</div>
      </section>

      <!-- WebSocket Greetings -->
      <section class="card">
        <h2>WebSocket Greetings</h2>
        <p>Stream greetings in real-time using the /ws endpoint</p>
        <p class="ws-url">Endpoint: {{ wsUrl }}</p>
        <div class="ws-status">
          <span class="status-dot" :class="wsStatus"></span>
          <span class="status-text">{{ wsStatusText }}</span>
        </div>
        <div class="form-group">
          <label for="ws-name">Display Name:</label>
          <input id="ws-name" v-model="wsName" type="text" placeholder="Name to broadcast" class="input" />
        </div>
        <div class="form-group">
          <label for="ws-message">Greeting Message:</label>
          <input
            id="ws-message"
            v-model="wsMessage"
            type="text"
            placeholder="Share a greeting with other tabs"
            class="input"
            @keyup.enter="handleSendWebSocketGreeting"
          />
        </div>
        <div class="button-group">
          <button class="button" @click="handleSendWebSocketGreeting" :disabled="!canSendGreeting">
            {{ wsStatus === 'connected' ? 'Send Greeting' : 'Connect to Send' }}
          </button>
          <button
            class="button secondary"
            type="button"
            @click="connectWebSocket"
            :disabled="wsStatus === 'connecting'"
          >
            {{ wsStatus === 'connected' ? 'Reconnect' : 'Connect' }}
          </button>
        </div>
        <div v-if="wsError" class="result error"><strong>Error:</strong> {{ wsError }}</div>
        <div v-if="wsMessages.length" class="ws-log">
          <strong>Live Feed:</strong>
          <ul>
            <li v-for="entry in wsMessages" :key="entry.id">
              <span class="timestamp">{{ formatTimestamp(entry.timestamp) }}</span>
              <span class="message"
                ><strong>{{ entry.name || 'Anonymous' }}:</strong> {{ entry.message }}</span
              >
              <span class="meta" v-if="entry.action && entry.action !== 'unknown'">({{ entry.action }})</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- API Info -->
      <section class="card">
        <h2>API Information</h2>
        <p>Get information about available endpoints</p>
        <button @click="handleInfo" :disabled="loading" class="button">
          {{ loading ? 'Loading...' : 'Get API Info' }}
        </button>
        <div v-if="infoResult" class="result success">
          <strong>API Name:</strong> {{ infoResult.name }}<br />
          <strong>Version:</strong> {{ infoResult.version }}<br />
          <strong>Framework:</strong> {{ infoResult.framework }}<br />
          <details class="endpoints-details">
            <summary><strong>Available Endpoints:</strong></summary>
            <ul class="endpoints-list">
              <li v-for="endpoint in infoResult.endpoints" :key="`${endpoint.method}-${endpoint.path}`">
                <span class="method">{{ endpoint.method }}</span>
                <span class="path">{{ endpoint.path }}</span>
                <span class="description">- {{ endpoint.description }}</span>
              </li>
            </ul>
          </details>
        </div>
        <div v-if="infoError" class="result error"><strong>Error:</strong> {{ infoError }}</div>
      </section>
    </main>

    <footer class="footer">
      <p>
        Built with
        <a href="https://github.com/scpxl/nodejs-framework" target="_blank">@scpxl/nodejs-framework</a>
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { API_URL, get, post, type HelloResponse, type InfoResponse, type PingResponse } from './api/client';

interface WebSocketGreetingMessage {
  id: string;
  type: string;
  action: string;
  message: string;
  name?: string;
  clientId?: string;
  timestamp: string;
}

const loading = ref(false);
const name = ref('');

// Ping state
const pingResult = ref<PingResponse | null>(null);
const pingError = ref<string | null>(null);

// Hello state
const helloResult = ref<HelloResponse | null>(null);
const helloError = ref<string | null>(null);

// Info state
const infoResult = ref<InfoResponse | null>(null);
const infoError = ref<string | null>(null);

// WebSocket state
const webSocket = ref<WebSocket | null>(null);
const wsStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
const wsError = ref<string | null>(null);
const wsMessages = ref<WebSocketGreetingMessage[]>([]);
const wsName = ref('');
const wsMessage = ref('');

const createMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultWsUrl = (() => {
  const explicitUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicitUrl) {
    return explicitUrl;
  }

  try {
    const url = new URL(API_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';

    return url.toString();
  } catch {
    return 'ws://localhost:3000/ws';
  }
})();

const wsUrl = ref(defaultWsUrl);

const wsStatusText = computed(() => {
  switch (wsStatus.value) {
    case 'connecting':
      return 'Connecting...';
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Connection Error';
    default:
      return 'Disconnected';
  }
});

const canSendGreeting = computed(() => wsStatus.value === 'connected' && wsMessage.value.trim().length > 0);

const formatTimestamp = (isoTimestamp: string) => {
  try {
    return new Date(isoTimestamp).toLocaleTimeString();
  } catch {
    return isoTimestamp;
  }
};

const connectWebSocket = () => {
  if (webSocket.value) {
    webSocket.value.close();
    webSocket.value = null;
  }

  wsStatus.value = 'connecting';
  wsError.value = null;

  try {
    const socket = new WebSocket(wsUrl.value);
    webSocket.value = socket;

    socket.addEventListener('open', () => {
      wsStatus.value = 'connected';
    });

    socket.addEventListener('message', event => {
      const receivedAt = new Date().toISOString();
      let parsed: any;

      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        parsed = null;
      }

      const entry: WebSocketGreetingMessage = {
        id: createMessageId(),
        type: parsed?.type ?? 'message',
        action: parsed?.action ?? 'unknown',
        message:
          typeof parsed?.data?.message === 'string'
            ? parsed.data.message
            : typeof event.data === 'string'
              ? event.data
              : '[binary message]',
        name: typeof parsed?.data?.name === 'string' ? parsed.data.name : undefined,
        clientId:
          typeof parsed?.data?.clientId === 'string'
            ? parsed.data.clientId
            : typeof parsed?.clientId === 'string'
              ? parsed.clientId
              : undefined,
        timestamp: typeof parsed?.data?.timestamp === 'string' ? parsed.data.timestamp : receivedAt,
      };

      wsMessages.value.unshift(entry);

      if (wsMessages.value.length > 20) {
        wsMessages.value.splice(20);
      }
    });

    socket.addEventListener('close', () => {
      wsStatus.value = 'disconnected';
    });

    socket.addEventListener('error', () => {
      wsStatus.value = 'error';
      wsError.value = 'WebSocket connection error';
    });
  } catch (error) {
    wsStatus.value = 'error';
    wsError.value = error instanceof Error ? error.message : 'Unable to open WebSocket connection';
  }
};

const disconnectWebSocket = () => {
  if (webSocket.value) {
    webSocket.value.close();
    webSocket.value = null;
  }
};

const handleSendWebSocketGreeting = () => {
  if (!webSocket.value || wsStatus.value !== 'connected') {
    wsError.value = 'Connect to the WebSocket server before sending.';
    return;
  }

  wsError.value = null;

  const payload = {
    type: 'hello',
    action: 'greet',
    data: {
      name: wsName.value.trim() || name.value.trim() || 'Guest',
      message: wsMessage.value.trim() || 'Hello from the browser!',
    },
  };

  webSocket.value.send(JSON.stringify(payload));
  wsMessage.value = '';
};

onMounted(() => {
  connectWebSocket();
});

onBeforeUnmount(() => {
  disconnectWebSocket();
});

const handlePing = async () => {
  loading.value = true;
  pingResult.value = null;
  pingError.value = null;

  try {
    const data = await get<PingResponse>('/api/ping');
    pingResult.value = data;
  } catch (error) {
    pingError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
};

const handleHello = async () => {
  if (!name.value) return;

  loading.value = true;
  helloResult.value = null;
  helloError.value = null;

  try {
    const data = await post<HelloResponse, { name: string }>('/api/hello', { name: name.value });
    helloResult.value = data;
  } catch (error) {
    helloError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
};

const handleInfo = async () => {
  loading.value = true;
  infoResult.value = null;
  infoError.value = null;

  try {
    const data = await get<InfoResponse>('/api/info');
    infoResult.value = data;
  } catch (error) {
    infoError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
};
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  color: white;
  padding: 40px 20px;
}

.header h1 {
  font-size: 3em;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 1.2em;
  opacity: 0.9;
}

.main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.card h2 {
  color: #667eea;
  margin-bottom: 10px;
  font-size: 1.5em;
}

.card > p {
  color: #666;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #555;
  font-weight: 500;
}

.input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.input:focus {
  outline: none;
  border-color: #667eea;
}

.button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  width: 100%;
}

.button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.button:active:not(:disabled) {
  transform: translateY(0);
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result {
  margin-top: 15px;
  padding: 15px;
  border-radius: 8px;
  font-size: 14px;
}

.result.success {
  background-color: #e8f5e9;
  border-left: 4px solid #4caf50;
}

.result.error {
  background-color: #ffebee;
  border-left: 4px solid #f44336;
  color: #c62828;
}

.result pre {
  margin-top: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

.endpoints-details {
  margin-top: 10px;
}

.endpoints-details summary {
  cursor: pointer;
  padding: 5px;
  user-select: none;
}

.endpoints-details summary:hover {
  background: rgba(102, 126, 234, 0.1);
  border-radius: 4px;
}

.endpoints-list {
  list-style: none;
  margin-top: 10px;
  padding-left: 10px;
}

.endpoints-list li {
  padding: 8px;
  margin-bottom: 5px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.method {
  display: inline-block;
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 8px;
}

.path {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #333;
}

.description {
  color: #666;
  font-size: 13px;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.button.secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.button.secondary:hover:not(:disabled) {
  box-shadow: 0 5px 15px rgba(255, 255, 255, 0.4);
}

.ws-url {
  font-size: 0.9em;
  color: #555;
  margin-bottom: 12px;
  word-break: break-all;
}

.ws-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  font-weight: 600;
  color: #444;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #bbb;
  display: inline-block;
}

.status-dot.connecting {
  background: #f6ad55;
}

.status-dot.connected {
  background: #48bb78;
}

.status-dot.error {
  background: #f56565;
}

.status-dot.disconnected {
  background: #bbb;
}

.ws-log {
  margin-top: 20px;
  background: #f4f6ff;
  border-left: 4px solid #667eea;
  border-radius: 8px;
  padding: 12px;
  max-height: 260px;
  overflow-y: auto;
}

.ws-log ul {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ws-log li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: white;
  border-radius: 6px;
  padding: 10px 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.12);
}

.ws-log .timestamp {
  font-size: 12px;
  color: #667eea;
}

.ws-log .message {
  font-size: 14px;
  color: #333;
}

.ws-log .meta {
  font-size: 12px;
  color: #888;
}

.footer {
  text-align: center;
  color: white;
  padding: 40px 20px 20px;
  opacity: 0.9;
}

.footer a {
  color: white;
  text-decoration: underline;
}

.footer a:hover {
  opacity: 0.8;
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2em;
  }

  .main {
    grid-template-columns: 1fr;
  }

  .card {
    padding: 20px;
  }
}
</style>
