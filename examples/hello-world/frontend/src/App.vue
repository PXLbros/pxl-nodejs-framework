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
import { ref } from 'vue';
import { get, post, type PingResponse, type HelloResponse, type InfoResponse } from './api/client';

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
