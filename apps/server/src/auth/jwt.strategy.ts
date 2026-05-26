import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  walletAddress: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: any) => {
        if (req?.cookies?.jwt) return req.cookies.jwt;
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwtSecret') || (() => { throw new Error('JWT_SECRET environment variable is required'); })(),
      passReqToCallback: false,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      walletAddress: payload.walletAddress,
      role: payload.role,
    };
  }
}
