/**
 * Contracts of the Group-12-Auth service (NestJS) and the session the frontend
 * derives from them.
 */

/** Administrator roles stored in `admins.roles` and carried in the JWT `role` claim. */
export type AdminRole = 'super_admin' | 'operations' | 'finance';

export const ADMIN_ROLES: readonly AdminRole[] = ['super_admin', 'operations', 'finance'];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  operations: 'Operations Admin',
  finance: 'Finance Admin',
};

/** Body of POST /auth/login (LoginDto). The field is `email`, never `username`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Body of POST /auth/register (RegisterDto). Clients only; the service hashes the
 * password itself and rejects any extra property (for example a confirmation field).
 */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Formatted as 123-45-6789. */
  ssn: string;
  /** A valid US number of at most 12 characters, for example 202-456-1111. */
  phoneNumber: string;
  /** ISO 8601 calendar date (YYYY-MM-DD); the `clients.date_of_birth` column is NOT NULL. */
  dateOfBirth: string;
}

/** Password policy Group-12-Auth enforces for client registration (same as the backend's admin policy). */
export const CLIENT_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,72}$/;

/** `admin` object returned by POST /auth/login for an admin-domain email. */
export interface AdminProfile {
  adminId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

/**
 * `client` object returned by POST /auth/login for every other email, and by
 * POST /auth/register on success (no SSN, no hash).
 */
export interface ClientProfile {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  accountBalance: string;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  admin?: AdminProfile;
  client?: ClientProfile;
}

/** Payload of the HS256 JWT. Admin tokens carry `role`; client tokens carry `roles: ['CLIENT']`. */
export interface JwtClaims {
  sub: string;
  email: string;
  role?: AdminRole;
  roles?: string[];
  iat: number;
  exp: number;
}

export type UserKind = 'client' | 'admin';

export interface SessionUser {
  kind: UserKind;
  /** clientId or adminId, depending on `kind`. */
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  /** Present for administrators only. */
  role: AdminRole | null;
  createdAt: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: SessionUser;
  /** Epoch milliseconds, taken from the JWT `exp` claim. */
  expiresAt: number;
  issuedAt: number;
}
