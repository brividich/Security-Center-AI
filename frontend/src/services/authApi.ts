import { securityApiFetch } from "./securityApiClient.csrf";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
}

export interface LoginResponse {
  authenticated: boolean;
  user: User;
}

export interface AuthStatusResponse {
  csrfToken: string;
  authenticated: boolean;
  user: User;
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return securityApiFetch<AuthStatusResponse>("/api/security/auth/login/");
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return securityApiFetch<LoginResponse>("/api/security/auth/login/", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function logout(): Promise<void> {
  return securityApiFetch<void>("/api/security/auth/logout/", {
    method: "POST",
  });
}
