import { Suspense } from "react";
import { PromoCodeDetailClient } from "./_components/promo-code-detail-client";

export default function PromoCodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 16: params — Promise.
  return (
    <Suspense
      fallback={<div className="p-6 text-muted-foreground">Загрузка...</div>}
    >
      <PromoCodeDetailClient params={params} />
    </Suspense>
  );
}
