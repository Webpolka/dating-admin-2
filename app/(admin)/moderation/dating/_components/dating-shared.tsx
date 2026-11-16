// app/(admin)/moderation/dating/_components/dating-shared.tsx
"use client";

import { ThumbsUp, ThumbsDown, Star } from "lucide-react";
import type { StatusTabDef } from "@/components/admin/status-tabs";

// ============================================================
// Константы
// ============================================================

export { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

// ============================================================
// Конфиги табов
// ============================================================

// Режим просмотра: свайпы или матчи.
export const MODE_TABS: ReadonlyArray<StatusTabDef<"swipes" | "matches">> = [
  { value: "swipes", label: "Свайпы" },
  { value: "matches", label: "Матчи" },
];

// Фильтр по типу свайпа. Цвета иконок — семантические цвета категорий
// (лайк — зелёный, дизлайк — красный, суперлайк — жёлтый).
export const TYPE_FILTERS: ReadonlyArray<
  StatusTabDef<"all" | "like" | "dislike" | "superlike">
> = [
  { value: "all",       label: "Все",        icon: null },
  { value: "like",      label: "Лайки",      icon: ThumbsUp,   iconColor: "text-green-500" },
  { value: "dislike",   label: "Дизлайки",   icon: ThumbsDown, iconColor: "text-red-500" },
  { value: "superlike", label: "Суперлайки", icon: Star,       iconColor: "text-yellow-500" },
];
