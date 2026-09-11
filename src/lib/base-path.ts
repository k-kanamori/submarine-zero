export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/submarine-zero";

export function assetPath(path: string): string {
  return `${basePath}${path}`;
}
