"use client";

// app/(admin)/finance/promo-codes/_components/promo-codes-shared.tsx
//
// Константы UI для раздела промокодов.

import {
  Ticket, Percent, Coins, Crown, Gem,
  CheckCircle, XCircle, Clock, AlertTriangle,
} from "lucide-react";

export { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

/**
 * Вкладки фильтра статусов.
 * value — значение для API (status=...).
 */
export const STATUS_TABS: Array<{
  value: string; // "all" | "active" | "inactive" | "expired" | "fully_used"
  label: string;
  icon: typeof Clock;
  iconColor: string;
}> = [
  { value: "all",        label: "Все",         icon: Ticket,        iconColor: "text-muted-foreground" },
  { value: "active",     label: "Активные",    icon: CheckCircle,   iconColor: "text-green-500" },
  { value: "inactive",   label: "Отключены",   icon: XCircle,       iconColor: "text-muted-foreground" },
  { value: "expired",    label: "Истёкшие",    icon: Clock,         iconColor: "text-yellow-500" },
  { value: "fully_used", label: "Исчерпаны",   icon: AlertTriangle, iconColor: "text-orange-500" },
];

/** Опции для dropdown фильтра типа. */
export const TYPE_OPTIONS = [
  { value: "all", label: "Все типы" },
  { value: "percent", label: "Скидка %" },
  { value: "fixed", label: "Скидка ₽" },
  { value: "premium", label: "Premium (дни)" },
  { value: "vip", label: "VIP (дни)" },
];

/** Опции для dropdown фильтра scope. */
export const SCOPE_OPTIONS = [
  { value: "all", label: "Все (общие + персональные)" },
  { value: "general", label: "Общие" },
  { value: "personal", label: "Персональные" },
];

/** Иконка для типа промокода. */
export function getTypeIcon(type: string) {
  switch (type) {
    case "percent": return Percent;
    case "fixed": return Coins;
    case "premium": return Crown;
    case "vip": return Gem;
    default: return Ticket;
  }
}

export const PAGE_TITLE = "Промокоды";
export const PAGE_DESCRIPTION = "Управление промокодами для скидок и бесплатных дней подписки";
export const PAGE_ICON = Ticket; 