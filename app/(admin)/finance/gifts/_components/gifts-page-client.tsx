// app/(admin)/finance/gifts/_components/gifts-page-client.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SectionTabs } from "@/components/admin/section-tabs";
import { CatalogTab } from "./catalog-tab";
import { HistoryTab } from "./history-tab";
import { GIFT_TABS, type Tab } from "./_shared";

export function GiftsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) ?? "catalog");
  // pendingCatalogSearch — когда кликаешь на подарок в истории, он переключается
  // на вкладку "Каталог" и подставляет ID в поиск.
  const [pendingCatalogSearch, setPendingCatalogSearch] = useState<string | null>(null);

  // Смена таба — только state, без записи URL. Единственный писатель полного
  // URL (?tab=...&q=...&page=...) — эффект самого таба; свежесмонтированный
  // таб гидратируется через getInitialUrlParam (window.location.search).
  const handleTabChange = (next: Tab) => setTab(next);

  // Колбэк для клика по подарку в истории → переключение на каталог + поиск по ID.
  // pendingSearch применяется эффектом CatalogTab после монтирования.
  const handleGiftClick = (giftId: number) => {
    setPendingCatalogSearch(String(giftId));
    setTab("catalog");
  };

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={Gift}
        title="Подарки и монетизация"
        description="Управление каталогом и финансовой историей"
        onBack={() => router.back()}
      />

      {/* Табы-разделы */}
      <SectionTabs tabs={GIFT_TABS} value={tab} onChange={handleTabChange} />

      {tab === "catalog"
        ? <CatalogTab pendingSearch={pendingCatalogSearch} onPendingSearchConsumed={() => setPendingCatalogSearch(null)} />
        : <HistoryTab onGiftClick={handleGiftClick} />}
    </div>
  );
}
