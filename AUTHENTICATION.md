# Authentication for WebServer Controllers

This framework provides simplified authentication for webserver controller actions. You no longer need to manually handle JWT token verification in each route.

## Features

- Automatic JWT token validation
- Multiple authentication approaches (decorator, wrapper function, manual)
- Type-safe authenticated requests
- Centralized error handling
- Easy access to authenticated user information

# Authentication for WebServer Controllers

This framework provides simplified authentication for webserver controller actions. You no longer need to manually handle JWT token verification in each route.

## Configuration

First, configure your JWT secret key in your application config:

```typescript
const applicationConfig: ApplicationConfig = {
  name: 'My App',
  // ... other config
  auth: {
    jwtSecretKey: process.env.JWT_SECRET_KEY || 'your-secret-key'
  }
};
```

## Features

- Automatic JWT token validation using application config
- Multiple authentication approaches (wrapper function, manual, helper method)
- Type-safe authenticated requests
- Centralized error handling
- Easy access to authenticated user information

## Usage

### Method 1: Wrapper Function Approach (Recommended)

Use the `withAuth` wrapper function for functional-style authentication:

```typescript
import { withAuth, AuthenticatedRequest } from 'pxl-nodejs-framework';

export default class UserController extends WebServerBaseController {
  
  public getUserTickers = withAuth(
    async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      const { userId } = request.user;
      
      const tickers = await this.getTickersForUser(userId);
      
      return this.sendSuccessResponse(reply, tickers);
    },
    this.authenticateRequest.bind(this)
  );
}
```

### Method 2: Manual Authentication

For more control, use the simplified manual authentication:

```typescript
export default class UserController extends WebServerBaseController {
  
  public getUserOrders = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await this.authenticateRequest(request, reply);
    
    if (!user) {
      // Authentication failed, error response already sent
      return;
    }
    
    const orders = await this.getOrdersForUser(user.userId);
    
    return this.sendSuccessResponse(reply, orders);
  };
}
```

### Method 3: Helper Method Approach

Create a helper method for inline authentication:

```typescript
export default class UserController extends WebServerBaseController {
  
  public getUserProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    return this.withAuthentication(request, reply, async (user) => {
      const userProfile = await this.getUserById(user.userId);
      return this.sendSuccessResponse(reply, userProfile);
    });
  };

  private async withAuthentication(
    request: FastifyRequest, 
    reply: FastifyReply, 
    handler: (user: AuthenticatedUser) => Promise<void>
  ): Promise<void> {
    const user = await this.authenticateRequest(request, reply);
    
    if (!user) return;
    
    return handler(user);
  }
}
```

## API Reference

### `AuthenticatedUser`
```typescript
interface AuthenticatedUser {
  userId: number;
  payload: any; // Full JWT payload
}
```

### `AuthenticatedRequest`
```typescript
interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}
```

### `withAuth(handler, authenticateRequest)`
Higher-order function that wraps a route handler with authentication.

### `authenticateRequest(request, reply)`
Base method for manual authentication. Returns `AuthenticatedUser | null`. JWT secret key is automatically retrieved from application config.

## Error Handling

All authentication methods automatically handle common authentication errors:
- Missing Authorization header
- Invalid token format (not Bearer token)
- Invalid or expired JWT token
- Missing or invalid token payload

Errors are automatically sent as HTTP responses with appropriate status codes (401 Unauthorized).

## Migration from Manual Authentication

**Before:**
```typescript
public getUserTickers = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return this.sendErrorResponse(reply, 'No token provided.', 401);
  } else if (!authHeader.startsWith('Bearer ')) {
    return this.sendErrorResponse(reply, 'Invalid token.', 401);
  }

  try {
    const jwtSecretKey = await Jwt.importJwtSecretKey({ jwtSecretKey: env.JWT_SECRET_KEY });
    const jwtAccessToken = authHeader.substring(7, authHeader.length);
    const { payload } = await Jwt.jwtVerify(jwtAccessToken, jwtSecretKey);

    if (!payload.sub) {
      return this.sendErrorResponse(reply, 'Invalid token payload.', 401);
    }

    const userId = parseInt(payload.sub);
    
    // Your business logic here...
  } catch (error) {
    return this.sendErrorResponse(reply, 'Invalid token.', 401);
  }
};
```

**After (using wrapper function):**
```typescript
public getUserTickers = withAuth(
  async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    const { userId } = request.user;
    
    // Your business logic here...
  },
  this.authenticateRequest.bind(this)
);
```

**After (using manual authentication):**
```typescript
public getUserTickers = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const user = await this.authenticateRequest(request, reply);
  
  if (!user) return;
  
  // Your business logic here...
};
```

## Environment Variables

Make sure to set your JWT secret key in your environment:
```bash
JWT_SECRET_KEY=your-secret-key-here
```

And configure it in your application config:
```typescript
const applicationConfig: ApplicationConfig = {
  // ... other config
  auth: {
    jwtSecretKey: process.env.JWT_SECRET_KEY!
  }
};
```
