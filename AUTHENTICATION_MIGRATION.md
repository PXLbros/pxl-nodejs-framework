# Authentication API Update Summary

## Changes Made

The authentication system has been updated to use the JWT secret key from the application configuration instead of passing it as a parameter to each authentication method.

## Before (Old API)

### Application Setup
```typescript
// JWT secret key passed manually to each method
process.env.JWT_SECRET_KEY
```

### Method Calls
```typescript
// Manual authentication
const user = await this.authenticateRequest(request, reply, process.env.JWT_SECRET_KEY);

// Wrapper function
public getUserTickers = withAuth(
  async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    // handler logic...
  },
  process.env.JWT_SECRET_KEY,
  this.authenticateRequest.bind(this)
);
```

## After (New API)

### Application Setup
```typescript
const applicationConfig: ApplicationConfig = {
  name: 'My App',
  // ... other config
  auth: {
    jwtSecretKey: process.env.JWT_SECRET_KEY || 'your-secret-key'
  }
};
```

### Method Calls
```typescript
// Manual authentication - cleaner, no JWT key parameter
const user = await this.authenticateRequest(request, reply);

// Wrapper function - simpler signature
public getUserTickers = withAuth(
  async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    // handler logic...
  },
  this.authenticateRequest.bind(this)
);
```

## Benefits

1. **Centralized Configuration**: JWT secret key is configured once in the application config
2. **Cleaner API**: No need to pass JWT secret key to every authentication method
3. **Better Error Handling**: Automatic validation that authentication is properly configured
4. **Consistency**: Follows the pattern of other framework configurations (database, redis, etc.)
5. **Type Safety**: ApplicationConfig interface ensures auth configuration is properly typed

## Breaking Changes

- `authenticateRequest(request, reply, jwtSecretKey)` → `authenticateRequest(request, reply)`
- `withAuth(handler, jwtSecretKey, authenticateRequest)` → `withAuth(handler, authenticateRequest)`
- Applications must now configure `auth.jwtSecretKey` in their ApplicationConfig

## Migration Guide

1. Add auth configuration to your application config:
   ```typescript
   const config: ApplicationConfig = {
     // ... existing config
     auth: {
       jwtSecretKey: process.env.JWT_SECRET_KEY!
     }
   };
   ```

2. Update all authentication method calls to remove the JWT secret key parameter:
   ```typescript
   // Before
   const user = await this.authenticateRequest(request, reply, process.env.JWT_SECRET_KEY);
   
   // After
   const user = await this.authenticateRequest(request, reply);
   ```

3. Update withAuth wrapper calls:
   ```typescript
   // Before
   withAuth(handler, process.env.JWT_SECRET_KEY, this.authenticateRequest.bind(this))
   
   // After
   withAuth(handler, this.authenticateRequest.bind(this))
   ```
