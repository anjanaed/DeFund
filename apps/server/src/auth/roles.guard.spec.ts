import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../generated/prisma';
import { ROLES_KEY } from './roles.decorator';

const makeContext = (userRole: string | undefined): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required (unprotected route)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows access when required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(makeContext('USER'))).toBe(true);
  });

  it('allows access when user role matches required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('allows access when user has one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.USER]);

    expect(guard.canActivate(makeContext('USER'))).toBe(true);
  });

  it('denies access when user role does not match any required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(makeContext('USER'))).toBe(false);
  });

  it('denies access when request has no user object', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('reads roles metadata using the correct ROLES_KEY', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const ctx = makeContext('ADMIN');

    guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      [expect.anything(), expect.anything()],
    );
  });
});
