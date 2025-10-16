# Hot Module Replacement (HMR)

The PXL Framework includes an enhanced HMR system for fast development iterations.

## Features

### 1. Incremental Compilation

- Fast rebuilds using incremental TypeScript compilation
- Only recompiles changed files
- Typical rebuild time: 200-500ms (vs 2-3s full rebuild)

### 2. Error Recovery

- Continues running even when build fails
- Shows clear error messages without crashing
- Automatically rebuilds when errors are fixed

### 3. Smart Change Detection

- Categorizes changes (routes, controllers, config, core)
- Applies appropriate refresh strategy
- Displays change summaries in console

### 4. WebSocket Auto-Reconnection

- Automatic reconnection on server restart
- Exponential backoff retry strategy
- Preserves client state across reconnections

## Usage

### Starting HMR

```bash
npm run dev
```

### WebSocket Auto-Reconnection

WebSocket clients automatically reconnect when the server restarts:

```typescript
import { WebSocketClient } from '@scpxl/nodejs-framework/websocket';

const wsClient = new WebSocketClient({
  // ... config
  options: {
    events: {
      onReconnecting: ({ attempt, delay }) => {
        console.log(`Reconnecting... attempt ${attempt}, waiting ${delay}ms`);
      },
      onReconnected: ({ clientId }) => {
        console.log(`Reconnected with client ID: ${clientId}`);
      },
      onReconnectFailed: ({ attempts }) => {
        console.error(`Failed to reconnect after ${attempts} attempts`);
      },
    },
  },
});

// Connect to server
await wsClient.connectToServer();

// Get connection status
const status = wsClient.getConnectionStatus();
console.log(status);
// { isConnected: true, reconnectAttempts: 0, autoReconnectEnabled: true }

// Manually disable auto-reconnect
wsClient.disableAutoReconnect();

// Manually enable auto-reconnect
wsClient.enableAutoReconnect();
```

## Configuration

### HMR Settings

The enhanced HMR watcher includes:

- **Debouncing**: 100ms delay to batch multiple changes
- **Change categorization**: Routes, controllers, config, core files
- **Error boundaries**: Continues running on build failures
- **Build metrics**: Shows build time and changed file count

### Reconnection Settings

WebSocket auto-reconnection uses:

- **Initial delay**: 1 second
- **Exponential backoff**: Doubles delay each attempt
- **Max delay**: 30 seconds
- **Max attempts**: 10

You can customize these in the WebSocketClient class:

```typescript
// Custom reconnection settings
const wsClient = new WebSocketClient(props);
// Access private properties through subclassing if needed
```

## Change Detection

The HMR watcher categorizes file changes:

### Routes

Files in `/routes/` directory

### Controllers

Files in `/controller/` or `/controllers/` directories

### Config

- `config` files
- `.env` files
- `tsconfig.json`
- `package.json`

These trigger full rebuild

### Core

All other TypeScript/JavaScript files

## Build Output

Enhanced HMR provides rich console output:

```
[10:30:45] 🚀 Starting HMR for PXL Node.js Framework
[10:30:45] ℹ️  Enhanced mode: Incremental compilation enabled
[10:30:45] 🔄 Rebuilding (1 route file(s))...
[10:30:46] ✅ Build completed in 234ms
[10:30:46] ℹ️  👁️  Watching: /home/user/project/src
[10:30:46] ✅ HMR watcher started. Press Ctrl+C to stop.

[10:31:23] 📝 Changed: src/routes/example.routes.ts
[10:31:23] 🔄 Rebuilding (1 route file(s))...
[10:31:23] ✅ Build completed in 187ms
```

## Performance

The HMR system provides fast incremental builds:

| Operation           | Time             | Notes                        |
| ------------------- | ---------------- | ---------------------------- |
| Initial build       | 2.5s             | Full compilation             |
| Small change        | 0.2s             | **11x faster** than full     |
| Route change        | 0.2s             | Incremental compilation      |
| Syntax error        | Continue running | Error recovery built-in      |
| WebSocket reconnect | Automatic        | Seamless client reconnection |

## Troubleshooting

### Build Fails Silently

Check the console for error messages. The watcher continues running even on errors.

### WebSocket Won't Reconnect

Ensure auto-reconnect is enabled:

```typescript
wsClient.enableAutoReconnect();
```

### Slow Rebuild Times

- Check if you have many files changing at once
- Ensure TypeScript incremental build is working (check for `.tsbuildinfo` file)
- Consider excluding large directories from the watcher

## Best Practices

1. **Use `npm run dev`**: Start the HMR development server for fast iterations
2. **Save Related Files Together**: HMR debounces changes, so saving multiple related files quickly is efficient
3. **Monitor Console**: Watch for build errors and fix them promptly
4. **Handle Reconnection Events**: Implement reconnection event handlers for better UX
5. **Clear Cache When Needed**: Use `Loader.clearModuleCache()` for manual cache clearing

## Future Enhancements

Planned improvements for HMR:

- [ ] Configuration hot-reload
- [ ] Plugin system for custom HMR strategies
- [ ] Performance profiling and optimization
