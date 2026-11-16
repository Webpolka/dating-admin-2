"use client";

// hooks/admin/use-sidebar-counts.ts
//
// Реальные счётчики очередей модерации для бейджей сайдбара.
//
// Раньше в app-sidebar.tsx лежал statsMock с захардкоженными числами —
// бейджи показывали фейковые «5 фото, 2 жалобы». Теперь тот же эндпоинт,
// что и у дашборда (GET /admin/dashboard/stats), опрашивается лёгким
// фоновым запросом: refetchInterval 60с, staleTime 30с.
//
// Тихий режим: useAdminItemQuery не тостит ошибки запросов, поэтому при
// сбое бейджи просто не показываются — сайдбар не шумит.
//
// Запрос включён только для admin/moderator: пункты меню с бейджами
// доступны только этим ролям (см. roles в lib/navigation.ts), support
// будет получать бесполезный 403.

import { useAdminItemQuery } from "@/hooks/admin/use-admin-api";
import type { DashboardStats } from "@/lib/api/dashboard";

/** badgeKey из lib/navigation.ts → поле DashboardStats. */
const BADGE_KEY_TO_STAT: Record<string, keyof DashboardStats> = {
  pendingPhotos: "pendingPhotos",
  pendingPhotoComments: "pendingPhotoComments",
  pendingDiaries: "pendingDiaries",
  pendingDiaryComments: "pendingDiaryComments",
  pendingReports: "pendingReports",
};

/**
 * Возвращает map badgeKey → счётчик из статистики дашборда.
 * Пока данных нет (загрузка/ошибка) — пустой объект, бейджи не рендерятся.
 */
export function useSidebarCounts(enabled: boolean): Record<string, number> {
  const { data } = useAdminItemQuery<DashboardStats>(
    ["admin", "sidebar", "counts"],
    "/admin/dashboard/stats",
    { refetchInterval: 60_000, staleTime: 30_000, enabled },
  );

  if (!data) return {};

  const counts: Record<string, number> = {};
  for (const [badgeKey, statField] of Object.entries(BADGE_KEY_TO_STAT)) {
    counts[badgeKey] = Number(data[statField]) || 0;
  }
  return counts;
}
