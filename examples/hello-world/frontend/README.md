# Hello World Frontend - Vue 3 + TypeScript + Vite

A simple Vue 3 + TypeScript frontend that demonstrates consuming the PXL Framework API.

## Features

- ✅ Vue 3 with Composition API (`<script setup>`)
- ✅ TypeScript for type safety
- ✅ Vite for fast development
- ✅ Clean, modern UI design
- ✅ Type-safe API client wrapper
- ✅ Error handling
- ✅ Responsive design
- ✅ Hot module replacement (HMR)
- ✅ Live WebSocket feed with client-side parsing and UI updates

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend server running (see `../backend/README.md`)

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Copy environment file:**

   ```bash
   cp .env.example .env
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:5173
   ```

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview production build locally
- `npm run typecheck` - Run TypeScript type checking

## Features Demo

The app includes three interactive sections:

### 1. API Health Check

- Calls `GET /api/ping`
- Displays server status and timestamp
- Useful for testing connectivity

### 2. Greeting Endpoint

- Calls `POST /api/hello` with custom name
- Enter your name and get a personalized greeting
- Demonstrates POST requests with JSON body

### 3. WebSocket Greetings

- Opens a persistent connection to `ws://<backend>/ws`
- Streams real-time greetings from every connected client/tab
- Shows connection status, endpoint URL, and the latest 20 events

### 4. API Information

- Calls `GET /api/info`
- Shows all available endpoints
- Displays API version and framework info

## Configuration

The frontend uses environment variables for configuration:

- `VITE_API_URL` - Backend API URL (default: http://localhost:3000)
- `VITE_WS_URL` - Optional override for the WebSocket endpoint (default: derived from `VITE_API_URL`)

Edit `.env` to customize.

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts       # Type-safe API client (fetch wrapper)
│   ├── App.vue             # Main application component
│   ├── main.ts             # Application entry point
│   └── env.d.ts            # TypeScript environment declarations
├── public/                 # Static assets
├── index.html              # HTML template
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── tsconfig.node.json      # TypeScript config for build tools
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## API Client

The app includes a type-safe API client (`src/api/client.ts`) with:

- `get<T>(endpoint)` - Make type-safe GET requests
- `post<T, D>(endpoint, data)` - Make type-safe POST requests
- Automatic JSON parsing
- Error handling
- TypeScript type definitions for all responses

Example usage:

```typescript
import { get, post, type PingResponse, type HelloResponse } from './api/client';

// Type-safe GET request
const data = await get<PingResponse>('/api/ping');

// Type-safe POST request
const result = await post<HelloResponse, { name: string }>('/api/hello', { name: 'Alice' });
```

### Type Definitions

The client includes TypeScript interfaces for all API responses:

- `PingResponse` - Health check response
- `HelloResponse` - Greeting response
- `InfoResponse` - API information response
- `ApiEndpoint` - Endpoint metadata

## TypeScript Support

This example uses modern Vue 3 + TypeScript features:

- **`<script setup lang="ts">`** - Concise syntax with full TypeScript support
- **Generic API calls** - Type-safe HTTP requests with generic types
- **Typed refs** - `ref<PingResponse | null>(null)` for reactive state
- **Type imports** - `import type { ... }` for type-only imports
- **Environment types** - Custom `env.d.ts` for Vite env variables

## Styling

The app uses vanilla CSS with:

- Gradient backgrounds
- Card-based layout
- Responsive grid design
- Modern shadows and transitions
- Mobile-friendly breakpoints

## Development Tips

1. **API Proxy**: Vite is configured to proxy `/api` requests to the backend server
2. **Hot Reload**: Changes to `.vue` or `.ts` files trigger instant updates
3. **Type Checking**: Run `npm run typecheck` to check types without building
4. **CORS**: Backend has CORS enabled for cross-origin requests
5. **DevTools**: Use Vue DevTools browser extension for debugging
6. **WebSocket Demo**: Open the app in multiple browser tabs to watch greetings broadcast in real-time

## Connecting to Backend

Make sure the backend server is running first:

```bash
# In another terminal
cd ../backend
npm install
npm run dev
```

The backend should be running on `http://localhost:3000`

## Next Steps

Extend this example:

- Add more API endpoints with TypeScript types
- Implement authentication (JWT) with typed tokens
- Add WebSocket support for real-time updates
- Create reusable TypeScript components
- Add state management (Pinia with TypeScript)
- Implement routing (Vue Router with typed routes)

## Troubleshooting

**Cannot connect to API:**

- Ensure backend is running on port 3000
- Check `.env` file has correct `VITE_API_URL`
- Verify CORS is enabled in backend

**Build errors:**

- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Ensure Node.js version is 18+
- Run `npm run typecheck` to identify TypeScript errors

**Port already in use:**

- Change port in `vite.config.js` or use: `npm run dev -- --port 5174`

## Browser Support

Works with all modern browsers that support:

- ES6+ JavaScript
- CSS Grid
- Fetch API
- Vue 3

Tested on:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
