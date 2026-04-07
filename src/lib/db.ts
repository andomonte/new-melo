// src/lib/db.ts
// ⚠️ DEPRECATED: Use getPgPool() from '@/lib/pg' instead
// This file is kept for backwards compatibility only
import { getPgPool } from './pg';

export const pool = getPgPool();
