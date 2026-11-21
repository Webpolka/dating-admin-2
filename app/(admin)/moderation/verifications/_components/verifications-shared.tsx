"use client";

// app/(admin)/moderation/verifications/_components/verifications-shared.tsx
//
// Константы UI модерации верификаций.

import {
  Clock, CheckCircle, XCircle, BadgeCheck,
} from "lucide-react";

export { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

/**
 * Вкладки статусов модерации верификаций.
 * Без карантина — у верификаций нет soft-delete (single-shot заявка).
 */
export const STATUS_TABS: Array<{
  value: "pending" | "approved" | "rejected";
  label: string;
  icon: typeof Clock;
  iconColor: string;
}> = [
  { value: "pending",  label: "Ожидают",   icon: Clock,        iconColor: "text-yellow-500" },
  { value: "approved", label: "Одобрены",  icon: CheckCircle,  iconColor: "text-green-500" },
  { value: "rejected", label: "Отклонены", icon: XCircle,      iconColor: "text-red-500" },
];

/** Главный заголовок раздела. */
export const PAGE_TITLE = "Модерация верификаций";
export const PAGE_DESCRIPTION = "Проверка заявок на верификацию пользователей (фото с кодом-жестом)";
export const PAGE_ICON = BadgeCheck; 