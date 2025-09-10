// Main lifecycle management
export { LifecycleManager } from './lifecycle-manager.js';
export { ShutdownController } from './shutdown-controller.js';

// Exit handling
export { requestExit, setExitHandler } from './exit.js';

// Types and interfaces
export type { ExitCode, ExitOutcome } from './exit.js';

export type { Disposable, LifecycleHook, LifecycleConfig } from './types.js';

export { LifecyclePhase } from './types.js';
