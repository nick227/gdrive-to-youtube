export function validateEnv(): void {
  const required = ['DATABASE_URL'];
  
  if (process.env.NODE_ENV === 'production') {
    required.push('SESSION_SECRET');
  }

  const missing: string[] = [];
  
  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please set these in your environment or .env file.'
    );
  }

  // Warn about weak session secret in production
  if (process.env.NODE_ENV === 'production') {
    const sessionSecret = process.env.SESSION_SECRET;
    if (
      !sessionSecret ||
      sessionSecret === 'dev-secret-change-in-production' ||
      sessionSecret.length < 32
    ) {
      throw new Error(
        'SESSION_SECRET must be set to a strong random string (at least 32 characters) in production'
      );
    }
  }
}






