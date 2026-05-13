import { homedir } from 'node:os';

import type { TraceStore } from './TraceStore';

interface InitableStore extends TraceStore {
  init(): Promise<void>;
}

function toLibsqlUrl(connectionString: string): string {
  // Already a file: or :memory: URL — pass through
  if (connectionString.startsWith('file:') || connectionString === ':memory:') {
    return connectionString;
  }
  // Strip sqlite:// scheme and expand ~ so @libsql/client gets a valid file: URL
  const raw = connectionString.replace(/^sqlite:\/\//, '');
  const expanded = raw.startsWith('~/') ? homedir() + raw.slice(1) : raw;
  return `file:${expanded}`;
}

export class StoreResolver {
  static async resolve(connectionString: string): Promise<TraceStore> {
    let store: InitableStore;

    if (
      connectionString.startsWith('sqlite://') ||
      connectionString.startsWith('file:') ||
      connectionString === ':memory:'
    ) {
      const { SqliteStore } = await import('./SqliteStore');
      store = new SqliteStore(toLibsqlUrl(connectionString));
    } else if (
      connectionString.startsWith('postgres://') ||
      connectionString.startsWith('postgresql://')
    ) {
      const { PostgresStore } = await import('./PostgresStore');
      store = new PostgresStore(connectionString);
    } else if (connectionString.startsWith('mysql://')) {
      const { MySqlStore } = await import('./MySqlStore');
      store = new MySqlStore(connectionString);
    } else {
      throw new Error(
        `Unsupported store connection string: "${connectionString}". Expected sqlite://, postgres://, or mysql://`
      );
    }

    await store.init();
    return store;
  }
}
