import type { TraceStore } from './TraceStore'

export class StoreResolver {
  static async resolve(connectionString: string): Promise<TraceStore> {
    if (connectionString.startsWith('sqlite://') || connectionString.startsWith('file:')) {
      const { SqliteStore } = await import('./SqliteStore')
      const url = connectionString.replace(/^sqlite:\/\//, '')
      return new SqliteStore(url)
    }

    if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
      const { PostgresStore } = await import('./PostgresStore')
      return new PostgresStore(connectionString)
    }

    if (connectionString.startsWith('mysql://')) {
      const { MySqlStore } = await import('./MySqlStore')
      return new MySqlStore(connectionString)
    }

    throw new Error(`Unsupported store connection string: "${connectionString}". Expected sqlite://, postgres://, or mysql://`)
  }
}
