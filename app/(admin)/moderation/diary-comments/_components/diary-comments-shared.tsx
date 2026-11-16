// app/(admin)/moderation/diary-comments/_components/diary-comments-shared.tsx
"use client";

import {
  MessagesSquare, Clock, CheckCircle, XCircle, Trash2,
} from "lucide-react";
import type { StatusTabDef } from "@/components/admin/status-tabs";

// ============================================================
// Константы
// ============================================================

export { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

// ============================================================
// STATUS_TABS — табы фильтра статуса комментариев к дневникам.
// Цвета иконок — семантические цвета статусов модерации.
// ============================================================

export const STATUS_TABS: ReadonlyArray<
  StatusTabDef<"all" | "pending" | "approved" | "rejected" | "karantine">
> = [
  { value: "all",       label: "Все",       icon: MessagesSquare, iconColor: "text-muted-foreground" },
  { value: "pending",   label: "Ожидают",   icon: Clock,          iconColor: "text-yellow-500" },
  { value: "approved",  label: "Одобрены",  icon: CheckCircle,    iconColor: "text-green-500" },
  { value: "rejected",  label: "Отклонены", icon: XCircle,        iconColor: "text-red-500" },
  { value: "karantine", label: "Карантин",  icon: Trash2,         iconColor: "text-blue-500" },
];
