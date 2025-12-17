import { jwtVerify } from 'jose';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// Zod schema for JWT payload validation
const JWTPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: z.string(),
  isSessionToken: z.boolean().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Edge-compatible JWT verification with validation
export async function verifyAccessTokenEdge(token: string): Promise<JWTPayload> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Validate payload structure before returning
    const validatedPayload = JWTPayloadSchema.parse(payload);

    return validatedPayload;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid JWT payload structure');
    }
    throw new Error('Invalid access token');
  }
}