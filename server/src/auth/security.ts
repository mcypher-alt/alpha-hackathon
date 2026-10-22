export function jwtSecret():string {
  const secret=process.env.JWT_SECRET;
  if(secret&&secret.length>=32)return secret;
  if(process.env.NODE_ENV==='production')throw new Error('JWT_SECRET must contain at least 32 characters');
  return 'local-demo-only-alfa-secret-change-before-deployment-2026';
}
