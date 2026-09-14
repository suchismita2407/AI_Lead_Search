/**
 * Minimal ambient types for Bun built-ins used by DealFlow AI.
 *
 * Bun ships these at runtime; this file declares just the surface we use so
 * the project typechecks WITHOUT adding the bun-types npm package (disk +
 * dependency budget). The esbuild-based build does not typecheck, but editors
 * and `tsc --noEmit` pick these up via tsconfig's `include`.
 */
declare module "bun:sqlite" {
  export type SQLiteBindValue =
    | null
    | number
    | bigint
    | string
    | boolean
    | Uint8Array;

  export interface StatementResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class Statement {
    all(...params: SQLiteBindValue[]): Record<string, unknown>[];
    get(...params: SQLiteBindValue[]): Record<string, unknown> | undefined;
    run(...params: SQLiteBindValue[]): StatementResult;
    finalize(): void;
  }

  export class Database {
    constructor(
      path: string,
      options?: { create?: boolean; strict?: boolean },
    );
    exec(sql: string): void;
    query(sql: string): Statement;
    prepare(sql: string): Statement;
    close(): void;
  }
}

declare namespace Bun {
  namespace password {
    function hash(
      password: string,
      options?: Record<string, unknown>,
    ): Promise<string>;
    function verify(password: string, hash: string): Promise<boolean>;
    function hashSync(
      password: string,
      options?: Record<string, unknown>,
    ): string;
  }

  interface BunServerOptions {
    port: number;
    hostname: string;
    fetch: (req: Request) => Response | Promise<Response>;
  }

  interface ShellProcess {
    quiet(): ShellProcess;
    nothrow(): Promise<{ exitCode: number }>;
  }

  const $: (
    strings: TemplateStringsArray,
    ...expressions: unknown[]
  ) => ShellProcess;

  function serve(options: BunServerOptions): unknown;
  function file(path: string): Blob & { exists(): Promise<boolean> };
  function sleep(ms: number): Promise<void>;
}

interface ImportMeta {
  dir: string;
}