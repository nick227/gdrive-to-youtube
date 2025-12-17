export interface User {
  id: number;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
