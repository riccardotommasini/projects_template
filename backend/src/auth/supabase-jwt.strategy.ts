import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

type SupabaseJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

type AuthUser = {
  userID: string;
  email?: string;
  role?: string;
};

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: `${supabaseUrl}/auth/v1`,
      algorithms: ['RS256', 'ES256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
      }),
    });
  }

  validate(payload: SupabaseJwtPayload): AuthUser {
    return {
      userID: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
