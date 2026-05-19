export type AuthState = {
  email: string | null;
  error: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  userId: string | null;
};
