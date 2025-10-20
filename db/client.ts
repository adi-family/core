import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

if (!DATABASE_URL.startsWith('postgres://') && !DATABASE_URL.startsWith('postgresql://')) {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection string (starting with postgres:// or postgresql://)');
}

export const sql = postgres(DATABASE_URL, {
  types: {
    date: {
      to: 1082,
      from: [1082, 1114, 1184],
      serialize: (x: string) => x,
      parse: (x: string) => x,
    },
  },
});
