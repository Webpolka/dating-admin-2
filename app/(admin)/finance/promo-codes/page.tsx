import { Suspense } from "react";
import { PromoCodesPageClient } from "./_components/promo-codes-page-client";

export default function PromoCodesPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-muted-foreground">Загрузка...</div>}
    >
      <PromoCodesPageClient />
    </Suspense>
  );
}
