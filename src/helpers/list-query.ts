/** Shared query parsing and pagination meta for list endpoints. */

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ParsedListQuery = {
  page: number;
  limit: number;
  skip: number;
  q: string;
};

function firstString(q: unknown): string | undefined {
  if (q == null) return undefined;
  if (Array.isArray(q)) return q[0] != null ? String(q[0]) : undefined;
  return String(q);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseListQuery(
  query: Record<string, unknown>,
  opts?: { defaultLimit?: number; maxLimit?: number }
): ParsedListQuery {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 100;
  const rawPage = Number(firstString(query.page)) || 1;
  const page = Math.max(1, Math.floor(rawPage) || 1);
  let limit = Number(firstString(query.limit)) || defaultLimit;
  limit = Math.min(maxLimit, Math.max(1, Math.floor(limit) || defaultLimit));
  const skip = (page - 1) * limit;
  const q = (firstString(query.q) ?? firstString(query.search) ?? "").trim();
  return { page, limit, skip, q };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  return { total, page, limit, totalPages };
}

export function parseOptionalStatus(query: Record<string, unknown>, allowed: readonly string[]): string | undefined {
  const raw = (firstString(query.status) ?? "").trim();
  if (!raw || raw === "all") return undefined;
  return allowed.includes(raw) ? raw : undefined;
}

export function parseOptionalString(query: Record<string, unknown>, key: string): string | undefined {
  const v = (firstString(query[key]) ?? "").trim();
  return v || undefined;
}

/** For `active=true|false` query param. */
export function parseOptionalBoolean(query: Record<string, unknown>, key: string): boolean | undefined {
  const v = (firstString(query[key]) ?? "").toLowerCase().trim();
  if (!v || v === "all") return undefined;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}
