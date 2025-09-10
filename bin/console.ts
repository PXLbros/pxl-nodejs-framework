import { setExitHandler } from '../src/lifecycle/exit.js';

const APP_ROOT = new URL('../', import.meta.url);

// Example minimal application launcher
// This would be expanded based on CLI arguments or application configuration
async function main() {
  try {
    console.log('PXL Framework Console');
    console.log('APP_ROOT:', APP_ROOT);
    
    // Here you would typically:
    // 1. Parse CLI arguments
    // 2. Load configuration
    // 3. Create and configure your application
    // 4. Setup signal handlers
    // 5. Start the application
    
    // For now, this is a minimal placeholder
    console.log('No application configured. Update bin/console.ts to launch your application.');
    
    return { code: 0 as const, reason: 'no-app-configured' };
  } catch (error) {
    console.error('Application failed:', error);
    return { code: 1 as const, reason: 'startup-error', error };
  }
}

// Setup exit handler to properly handle process.exit()
setExitHandler((outcome) => {
  if (outcome.error) {
    console.error('Exit reason:', outcome.reason, outcome.error);
  } else if (outcome.reason !== 'shutdown-complete') {
    console.log('Exit reason:', outcome.reason);
  }
  process.exit(outcome.code);
});

// Signal handling for graceful shutdown
let signalReceived = false;

function setupSignalHandlers(shutdownFn: () => Promise<void>) {
  const handleSignal = async (signal: string) => {
    if (signalReceived) {
      console.log(`\nReceived ${signal} again, forcing exit...`);
      process.exit(130);
      return;
    }
    
    signalReceived = true;
    console.log(`\nReceived ${signal}, initiating graceful shutdown...`);
    
    try {
      await shutdownFn();
    } catch (error) {
      console.error('Shutdown error:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGHUP', () => handleSignal('SIGHUP'));
}

// Run main and handle result
main().then((outcome) => {
  if (outcome.code !== 0) {
    process.exit(outcome.code);
  }
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
