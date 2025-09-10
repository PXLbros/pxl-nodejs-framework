# Auth / JWT

Utilities for generating and verifying JWT access + refresh tokens using `jose`.

## Generating Tokens

```ts
import { Jwt } from '@scpxl/nodejs-framework/auth';

const tokens = await Jwt.generateJwtTokens({
  entityManager: orm.em,
  payload: { sub: user.id, role: user.role },
  jwtSecretKey: process.env.JWT_SECRET!,
});

console.log(tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
```

By default access: 24h, refresh: 30 days.

## Verifying

```ts
const key = await Jwt.importJwtSecretKey({ jwtSecretKey: process.env.JWT_SECRET! });
const { payload } = await Jwt.jwtVerify(tokens.accessToken, key);
```

## Recommendations

- Rotate secrets periodically.
- Store refresh tokens server-side if you need revocation lists.
- Keep payload minimal (ids + claims, no PII).
