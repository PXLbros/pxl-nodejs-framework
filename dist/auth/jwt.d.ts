import { JWTPayload } from 'jose';
export interface AuthenticationToken {
    type: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}
declare const _default: {
    generateJwtTokens: ({ entityManager, payload, jwtSecretKey, }: {
        entityManager: any;
        payload: JWTPayload;
        jwtSecretKey: string;
    }) => Promise<AuthenticationToken>;
    generateJwtToken: ({ secretKey, payload, expirationTime, }: {
        secretKey: any;
        payload: JWTPayload;
        expirationTime: number;
    }) => Promise<string>;
    importJwtSecretKey: ({ jwtSecretKey }: {
        jwtSecretKey: string;
    }) => Promise<any>;
};
export default _default;
//# sourceMappingURL=jwt.d.ts.map