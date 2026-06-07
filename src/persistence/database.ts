export interface DatabaseConfig {
  readonly filePath: string;
}

export interface DatabaseHandle {
  readonly filePath: string;
}

export function createDatabase(config: DatabaseConfig): DatabaseHandle {
  return {
    filePath: config.filePath
  };
}

