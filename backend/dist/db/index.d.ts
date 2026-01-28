import postgres from 'postgres';
import * as schema from './schema';
export declare const migrationClient: postgres.Sql<{}>;
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;
export type Database = typeof db;
//# sourceMappingURL=index.d.ts.map