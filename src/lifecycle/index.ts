// Main lifecycle management

// Types and interfaces
export type { ExitCode, ExitOutcome } from './exit.js';
// Exit handling
export { requestExit, setExitHandler } from './exit.js';
export { LifecycleManager } from './lifecycle-manager.js';
export { ShutdownController } from './shutdown-controller.js';

export type { Disposable, LifecycleConfig, LifecycleHook } from './types.js';

export { LifecyclePhase } from './types.js';
