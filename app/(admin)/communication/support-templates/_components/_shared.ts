// app/(admin)/communication/support-templates/_components/_shared.ts
//
// Общие константы для страницы шаблонов поддержки.

import { FileText, Folder } from "lucide-react";

import type { SectionTabDef } from "@/components/admin/section-tabs";

export { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
export const PER_PAGE = 15;

export type Tab = "templates" | "categories";

// Табы-разделы страницы (SectionTabs). Конфиг живёт здесь, рендер —
// в общем компоненте.
export const TEMPLATE_TABS: Array<SectionTabDef<Tab>> = [
  { value: "templates", label: "Шаблоны", icon: FileText },
  { value: "categories", label: "Категории", icon: Folder },
];
