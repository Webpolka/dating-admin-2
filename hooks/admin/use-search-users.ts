// hooks/admin/use-search-users.ts
"use client";

import type { UserBadgeData } from "@/lib/types";
import { useAdminListQuery } from "./use-admin-api";

// SearchUserItem = UserBadgeData из lib/types (created_at опционален —
// search-users его не отдаёт). Раньше тут был дублирующий интерфейс
// с теми же полями.
export type SearchUserItem = UserBadgeData;

export function useSearchUsers(query: string, enabled: boolean = true) {
  // QueryKey изменён с ["admin","broadcasts","search-users", query] на
  // ["admin","users","search", {q}] — старый ключ вводил в заблуждение
  // (поиск юзеров лежал в префиксе рассылок). Внешних инвалидаций старого
  // ключа нет (проверено grep'ом по app/ и components/). Endpoint тот же.
  return useAdminListQuery<{ q: string }, { data: SearchUserItem[] }>(
    ["admin", "users", "search"],
    "/admin/broadcasts/search-users",
    { q: query },
    { enabled: enabled && query.length >= 2, staleTime: 10_000 },
  );
}
