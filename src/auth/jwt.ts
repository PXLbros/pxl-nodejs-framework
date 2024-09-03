import { JWTPayload, importJWK, SignJWT } from 'jose';

export interface AuthenticationToken {
  type: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

const generateJwtTokens = async ({
  entityManager,
  payload,
  jwtSecretKey,
}: {
  entityManager: any;
  payload: JWTPayload;
  jwtSecretKey: string;
}): Promise<AuthenticationToken> => {
  // Import JWT secret key
  const importedJwtSecretKey = await importJwtSecretKey({ jwtSecretKey });

  const jwtAccessTokenLifetimeInHours = 1;
  const jwtRefreshTokenLifetime = 30 * 24;

  // Generate JWT access token
  const jwtAccessToken = await generateJwtToken({
    secretKey: importedJwtSecretKey,
    payload,
    expirationTime: jwtAccessTokenLifetimeInHours,
  });

  // Generate JWT refresh token
  const jwtRefreshToken = await generateJwtToken({
    secretKey: importedJwtSecretKey,
    payload,
    expirationTime: jwtRefreshTokenLifetime,
  });

  // // Update user's refresh token
  // user.refreshToken = jwtRefreshToken;

  await entityManager.flush();

  const jwtToken: AuthenticationToken = {
    type: 'Bearer',
    accessToken: jwtAccessToken,
    refreshToken: jwtRefreshToken,
    expiresAt: new Date(new Date().getTime() + jwtAccessTokenLifetimeInHours * 60 * 60 * 1000),
  };

  return jwtToken;
};

const generateJwtToken = async ({
  secretKey,
  payload,
  expirationTime,
}: {
  secretKey: any;
  payload: JWTPayload;
  expirationTime: number;
}): Promise<string> => {
  const jwtToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirationTime}h`)
    .sign(secretKey);

  return jwtToken;
};

const importJwtSecretKey = async ({ jwtSecretKey }: { jwtSecretKey: string }): Promise<any> => {
  return await importJWK({ kty: 'oct', k: jwtSecretKey }, 'HS256');
};

export default {
  generateJwtTokens,
  generateJwtToken,
  importJwtSecretKey,
};
