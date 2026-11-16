// app/(admin)/finance/subscription-plans/_components/subscription-plans-page-client.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import type { PlanTier } from "@/hooks/admin/use-subscription-plans";
import { PageHeader } from "@/components/admin/page-header";
import { SectionTabs } from "@/components/admin/section-tabs";
import { PlansTab } from "./plans-tab";
import { PLAN_TABS } from "./_shared";

export function SubscriptionPlansPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Таб читается из URL при первом рендере. URL пишет только эффект в
  // PlansTab (единственный писатель: tab + q) — при смене таба он же
  // допишет актуальный q, поэтому дублировать replace здесь не нужно.
  const [tab, setTab] = useState<PlanTier>(
    (searchParams.get("tab") as PlanTier) ?? "premium"
  );

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={CreditCard}
        title="Тарифы и подписки"
        description="Управление планами монетизации"
        onBack={() => router.back()}
      />

      {/* Табы-разделы */}
      <SectionTabs tabs={PLAN_TABS} value={tab} onChange={setTab} />

      {/* Контент по табу */}
      <PlansTab tier={tab} />
    </div>
  );
}
