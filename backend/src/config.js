import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://tcms:tcms_password@localhost:5432/tcms',
  jwtSecret: process.env.JWT_SECRET || 'tcms-development-secret',
  ssoEnabled: process.env.SSO_ENABLED === 'true',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
