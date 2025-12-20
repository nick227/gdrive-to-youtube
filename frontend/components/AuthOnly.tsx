import type { ReactNode } from 'react';

export function AuthOnly({
  user,
  children,
}: {
  user: unknown;
  children: ReactNode;
}) {
  if (!user) return null;
  return <>{children}</>;
}
