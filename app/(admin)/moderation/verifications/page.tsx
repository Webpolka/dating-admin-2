import { Suspense } from "react";
import { VerificationsPageClient } from "./_components/verifications-page-client";

export default function VerificationsPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-muted-foreground">Загрузка...</div>}
    >
      <VerificationsPageClient />
    </Suspense>
  );
}
