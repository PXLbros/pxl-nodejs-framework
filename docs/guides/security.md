# Security Best Practices

The PXL Framework includes built-in security features to help protect your application. This guide covers how to configure and use these features effectively.

## Default Security Features

The framework enables security features **by default** to provide a secure starting point:

### Helmet (Security Headers)

Helmet is **enabled by default** and adds the following security headers to all HTTP responses:

- **Content Security Policy (CSP)**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Strict-Transport-Security (HSTS)**: Forces HTTPS
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer-Policy**: Controls referrer information
- And more...

### Rate Limiting

Rate limiting is **enabled by default** with sensible limits:

- **1000 requests per minute** per IP address
- Automatic blocking of abusive clients
- Configurable limits and time windows

## Configuration

### Basic Security Configuration

```typescript
import { WebApplication } from '@scpxl/nodejs-framework';

const app = new WebApplication({
  name: 'my-app',
  webServer: {
    enabled: true,
    host: '0.0.0.0',
    port: 3000,

    // Security configuration (optional - defaults shown)
    security: {
      // Helmet configuration
      helmet: {
        enabled: true, // true by default
        contentSecurityPolicy: true,
        hsts: true,
        frameguard: true,
        noSniff: true,
        // ... all options enabled by default
      },

      // Rate limiting configuration
      rateLimit: {
        enabled: true, // true by default
        max: 1000, // Max requests per time window
        timeWindow: '1 minute', // Time window
        ban: undefined, // Optional: ban duration after limit exceeded
        cache: 5000, // Cache size for rate limit store
      },
    },
  },
  // ... other config
});
```

### Disabling Security Features (Not Recommended)

For development or specific use cases, you can disable security features:

```typescript
const app = new WebApplication({
  webServer: {
    security: {
      helmet: {
        enabled: false, // Disable helmet (not recommended)
      },
      rateLimit: {
        enabled: false, // Disable rate limiting (not recommended)
      },
    },
  },
});
```

### Custom Rate Limits

Adjust rate limits based on your application needs:

```typescript
const app = new WebApplication({
  webServer: {
    security: {
      rateLimit: {
        enabled: true,
        max: 100, // Stricter: 100 requests per time window
        timeWindow: '1 minute',
        ban: 5 * 60 * 1000, // Ban for 5 minutes after exceeding limit
      },
    },
  },
});
```

### Environment-Based Configuration

Use environment variables to configure security per environment:

```typescript
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';

const app = new WebApplication({
  webServer: {
    security: {
      rateLimit: {
        enabled: rateLimitEnabled,
        max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
      },
    },
  },
});
```

## CORS Configuration

CORS (Cross-Origin Resource Sharing) should be configured carefully in production:

```typescript
const app = new WebApplication({
  webServer: {
    cors: {
      enabled: true,
      // ❌ Bad: Wildcard in production
      urls: ['*'],

      // ✅ Good: Specific origins
      urls: ['https://myapp.com', 'https://www.myapp.com', 'https://admin.myapp.com'],
    },
  },
});
```

### CORS Warnings

The framework will **warn you** if you use wildcard CORS (`*`) in production:

```
⚠️  Wildcard CORS (*) is enabled in production - this is a security risk
    Recommendation: Specify allowed origins explicitly
```

## Request Size Limits

Protect against large request attacks by configuring body limits:

```typescript
const app = new WebApplication({
  webServer: {
    // Default: 25MB (safe default)
    bodyLimit: 25 * 1024 * 1024,

    // For file uploads, you may need larger limits:
    bodyLimit: 100 * 1024 * 1024, // 100MB

    // For APIs with small payloads:
    bodyLimit: 1 * 1024 * 1024, // 1MB
  },
});
```

## Connection Timeouts

Configure timeouts to prevent resource exhaustion:

```typescript
const app = new WebApplication({
  webServer: {
    // Default: 10 seconds (safe default)
    connectionTimeout: 10 * 1000,

    // For long-running requests:
    connectionTimeout: 30 * 1000, // 30 seconds
  },
});
```

## Input Validation

Always validate user input using Zod schemas (see [Schema Validation Patterns](./schema-validation-patterns.md)):

```typescript
import { z } from 'zod';
import { defineRoute } from '@scpxl/nodejs-framework/webserver';

const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    age: z.number().int().min(0).max(150),
  }),
};

export const routes = [
  defineRoute({
    method: 'POST',
    path: '/users',
    schema: createUserSchema,
    handler: async (request, reply) => {
      // request.body is fully validated and typed
      const { email, name, age } = request.body;
      // ...
    },
  }),
];
```

## WebSocket Security

WebSocket connections also benefit from rate limiting and authentication:

```typescript
const app = new WebApplication({
  webSocket: {
    enabled: true,
    type: 'server',
    // WebSocket connections share the same rate limiting as HTTP
    // Configure via webServer.security.rateLimit
  },
});
```

## Authentication

Use JWT-based authentication (see [Authentication Guide](./authentication.md)):

```typescript
import { JWTHelper } from '@scpxl/nodejs-framework/auth';

// Generate token
const token = await JWTHelper.generate({
  secretKey: process.env.JWT_SECRET,
  payload: { userId: '123', role: 'admin' },
  expiresIn: '1h',
});

// Verify token
const payload = await JWTHelper.verify({
  secretKey: process.env.JWT_SECRET,
  token,
});
```

## Security Checklist

### Production Deployment

- [ ] Helmet enabled (default: ✅)
- [ ] Rate limiting enabled (default: ✅)
- [ ] CORS configured with specific origins (not `*`)
- [ ] Body size limits configured appropriately
- [ ] Connection timeouts configured
- [ ] JWT secret key is strong and not hardcoded
- [ ] All user input is validated with Zod schemas
- [ ] HTTPS enabled (via reverse proxy like nginx)
- [ ] Environment variables secured (not committed to git)
- [ ] Database credentials secured
- [ ] Redis credentials secured (if applicable)
- [ ] Sentry error tracking configured (optional)

### Development

- [ ] Rate limiting can be disabled for local testing
- [ ] CORS can use wildcard for local development
- [ ] Use `.env` files for configuration (not committed)
- [ ] Test with realistic data sizes
- [ ] Test rate limiting behavior

## Common Security Issues

### Issue: Rate limit too high

**Problem**: Default 1000 requests/minute may be too permissive for some APIs

**Solution**: Lower the limit based on expected usage:

```typescript
security: {
  rateLimit: {
    max: 100, // Adjust based on your needs
    timeWindow: '1 minute',
  },
}
```

### Issue: CORS wildcard in production

**Problem**: Wildcard CORS allows any origin to access your API

**Solution**: Specify exact origins:

```typescript
cors: {
  enabled: true,
  urls: ['https://myapp.com'], // Only your domains
}
```

### Issue: No input validation

**Problem**: Accepting raw user input without validation

**Solution**: Use Zod schemas for all routes:

```typescript
import { NonEmptyStringSchema, EmailSchema } from '@scpxl/nodejs-framework/schemas';

const schema = {
  body: z.object({
    email: EmailSchema,
    name: NonEmptyStringSchema.max(100),
  }),
};
```

## Additional Resources

- [Typed Routes Guide](./typed-routes.md) - Type-safe routes with validation
- [Schema Validation Patterns](./schema-validation-patterns.md) - Reusable validation patterns
- [Authentication Guide](./authentication.md) - JWT authentication
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Security vulnerabilities to avoid

## Related

- [Configuration Guide](./configuration.md)
- [WebServer Concept](../concepts/webserver.md)
- [Error Handling](./error-handling.md)
