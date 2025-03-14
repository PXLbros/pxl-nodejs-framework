import { importJWK, SignJWT, jwtVerify } from 'jose';
const generateJwtTokens = async ({ entityManager, payload, jwtSecretKey, }) => {
    // Import JWT secret key
    const importedJwtSecretKey = await importJwtSecretKey({ jwtSecretKey });
    const jwtAccessTokenLifetimeInHours = 24;
    const jwtRefreshTokenLifetimeInHours = 30 * 24;
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
        expirationTime: jwtRefreshTokenLifetimeInHours,
    });
    await entityManager.flush();
    const jwtToken = {
        type: 'Bearer',
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken,
        expiresAt: new Date(new Date().getTime() + jwtAccessTokenLifetimeInHours * 60 * 60 * 1000),
    };
    return jwtToken;
};
const generateJwtToken = async ({ secretKey, payload, expirationTime, }) => {
    const jwtToken = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${expirationTime}h`)
        .sign(secretKey);
    return jwtToken;
};
const importJwtSecretKey = async ({ jwtSecretKey }) => {
    return await importJWK({ kty: 'oct', k: jwtSecretKey });
};
export default {
    generateJwtTokens,
    generateJwtToken,
    importJwtSecretKey,
    jwtVerify,
};
//# sourceMappingURL=jwt.js.map