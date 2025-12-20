import * as jose from 'jose';
import { randomUUID } from 'crypto'; // For generating JTI and general UUIDs
import { User } from './firestore-db';
import { structuredLog } from './correlation';
import { NextRequest } from 'next/server';

// Get secrets from environment variables
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_must_be_strong');
const REFRESH_SECRET = new TextEncoder().encode(process.env.REFRESH_SECRET || 'fallback_refresh_secret_must_be_strong');
const ISSUER = 'luno-app';
const AUDIENCE = 'luno-web';
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d';  // Long-lived refresh token
const ACCESS_TOKEN_KID = 'v1_access_key'; // Key ID for rotation tracking
const REFRESH_TOKEN_KID = 'v1_refresh_key'; // Key ID for rotation tracking

// --- Types ---
// Assuming User model has a migrationStatus field (legacy | migrated)
export type MigrationStatus = 'legacy' | 'migrated'; 

export interface AuthTokenPayload extends jose.JWTPayload {
  userId: string;
  roles: string[];
  migrationStatus: MigrationStatus;
}

// --- Token Generation ---

/**
 * Creates a JWT (Access or Refresh).
 * @param payload The custom claims to include.
 * @param secret The signing secret (ACCESS_SECRET or REFRESH_SECRET).
 * @param expiresIn The expiry time string (e.g., '15m', '7d').
 * @param kid The Key ID for rotation.
 * @returns The signed JWT string.
 */
async function createToken(
  payload: AuthTokenPayload,
  secret: Uint8Array,
  expiresIn: string,
  kid: string
): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(expiresIn)
    .setSubject(payload.userId)
    .setJti(randomUUID())
    .sign(secret);
}

/**
 * Generates an access token and a refresh token for a user.
 * @param user The user object (assuming User includes id, roles, and migrationStatus).
 * @returns An object containing the access and refresh tokens.
 */
export async function generateAuthTokens(user: Pick<User, 'id' | 'roles' | 'migrationStatus'>) {
  const basePayload: AuthTokenPayload = {
    userId: user.id,
    roles: user.roles || [], // Ensure roles is defined (assuming User now includes roles)
    migrationStatus: user.migrationStatus,
  };

  const accessToken = await createToken(basePayload, JWT_SECRET, ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_KID);
  
  // Refresh tokens typically have minimal claims, often just the subject/userId
  // We include migrationStatus for controlled refresh flow logic.
  const refreshPayload: AuthTokenPayload = { 
    userId: user.id, 
    roles: ['refresh'], // Minimal role for refresh token
    migrationStatus: user.migrationStatus 
  };
  const refreshToken = await createToken(refreshPayload, REFRESH_SECRET, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_KID);

  return { accessToken, refreshToken };
}

// --- Token Verification ---

/**
 * Verifies and decodes a JWT.
 * @param token The JWT string.
 * @param secret The verification secret.
 * @returns The JWT payload.
 */
async function verifyToken(token: string, secret: Uint8Array): Promise<AuthTokenPayload> {
  try {
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Future rotation logic would check the KID against known secrets
    });
    return payload as AuthTokenPayload;
  } catch (error: any) {
    console.log('verifyToken failed:', error.message);
    throw error;
  }
}

/**
 * Verifies an access token.
 */
export async function verifyAccessToken(token: string): Promise<AuthTokenPayload> {
  return verifyToken(token, JWT_SECRET);
}

/**
 * Verifies a refresh token.
 */
export async function verifyRefreshToken(token: string): Promise<AuthTokenPayload> {
  // NOTE: Refresh token validation should also include checking against a revocation list 
  // (e.g., in Firestore or Redis) to prevent replay/theft. This basic implementation 
  // only checks signature and expiry.
  return verifyToken(token, REFRESH_SECRET);
}

// --- Password Policy & Validation ---

const MIN_PASSWORD_LENGTH = 10;
// Requires at least 1 uppercase, 1 lowercase, 1 digit, 1 symbol, and min length.
// Symbols: !@#$%^&*()_+~`|}{[]:;?><,./-=
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+~`|}{[\]:;><,.\\/-=]).{10,}$/; 

/**
 * Robust password validation checking length and complexity requirements.
 * @param password The password string.
 * @returns True if valid, otherwise an error message string.
 */
export function validatePassword(password: string): true | string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol.';
  }
  return true;
}

/**
 * Utility to extract tokens from the request headers.
 */
export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}