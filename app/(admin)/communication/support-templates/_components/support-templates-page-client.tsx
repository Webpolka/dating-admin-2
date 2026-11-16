// app/(admin)/communication/support-templates/_components/support-templates-page-client.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { getInitialUrlParam, buildUrl } from "@/lib/url-params";
import { PageHeader } from "@/components/admin/page-header";
import { SectionTabs } from "@/components/admin/section-tabs";
import { TemplatesTab } from "./templates-tab";
import { CategoriesTab } from "./categories-tab";
import { TEMPLATE_TABS, type Tab } from "./_shared";

export function SupportTemplatesPageClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = useState<Tab>("templates");
  const [urlInitialized, setUrlInitialized] = useState(false);

  useEffect(() => {
    const urlTab = getInitialUrlParam("tab") as Tab;
    if (urlTab && ["templates", "categories"].includes(urlTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(urlTab);
    }
    setUrlInitialized(true);
  }, []);

  // URL-sync таба. Единственный писатель URL на уровне страницы:
  // SectionTabs только ставит state, запись делает этот эффект.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(buildUrl(pathname, { tab }), { scroll: false });
  }, [tab, router, pathname, urlInitialized]);

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={FileText}
        title="Шаблоны поддержки"
        description="Управление шаблонами и категориями для вставки в чат поддержки"
        onBack={() => router.back()}
      />

      {/* Табы-разделы */}
      <SectionTabs tabs={TEMPLATE_TABS} value={tab} onChange={setTab} />

      {tab === "templates" ? <TemplatesTab /> : <CategoriesTab />}
    </div>
  );
}
