declare module "node:child_process" {
  export function spawn(
    command: string,
    args?: string[],
    options?: {
      cwd?: string;
      detached?: boolean;
      stdio?: "ignore" | "inherit" | "pipe";
      windowsHide?: boolean;
    },
  ): { unref(): void };
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
