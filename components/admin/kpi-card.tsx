// components/admin/kpi-card.tsx
//
// Карточка KPI для дашборда: подпись, крупное значение, тонированная
// иконка, строка футера. До компонента этот JSX копировался 13 раз
// в dashboard-kpis.tsx (три ветки ролей) — теперь палитра и разметка
// живут в одном месте.
//
// Тон (tone) — семантический цвет категории из фиксированной палитры
// дашборда. Здесь же задаётся соответствие text-*/bg-*/10, чтобы
// расцветка не расползалась по файлам.

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTone = "blue" | "green" | "red" | "yellow" | "purple" | "indigo";

const TONE_CLASSES: Record<KpiTone, { value: string; box: string }> = {
  blue: { value: "text-blue-500", box: "bg-blue-500/10 text-blue-500" },
  green: { value: "text-green-500", box: "bg-green-500/10 text-green-500" },
  red: { value: "text-red-500", box: "bg-red-500/10 text-red-500" },
  yellow: { value: "text-yellow-500", box: "bg-yellow-500/10 text-yellow-500" },
  purple: { value: "text-purple-500", box: "bg-purple-500/10 text-purple-500" },
  indigo: { value: "text-indigo-500", box: "bg-indigo-500/10 text-indigo-500" },
};

interface KpiCardProps {
  label: string;
  /** Значение (число/строка, можно с префиксом «+»). */
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: KpiTone;
  /** Пульсирующая точка вместо иконки (для «онлайн»). */
  pulse?: boolean;
  /** Мелкая серая строка снизу (пара «Неделя/Месяц» или пояснение). */
  footer?: React.ReactNode;
}

export function KpiCard({ label, value, icon: Icon, tone, pulse = false, footer }: KpiCardProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className={cn("text-3xl font-bold mt-1", classes.value)}>{value}</p>
        </div>
        <div className={cn("p-2 rounded-lg", classes.box)}>
          {pulse ? (
            <div className="w-5 h-5 relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </div>
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
      </div>
      {footer && (
        <div className="flex items-center justify-between gap-2 mt-3 text-xs">{footer}</div>
      )}
    </Card>
  );
}

/** Пара «Неделя: N / Месяц: M» для футера KpiCard. */
export function KpiRange({ week, month }: { week: number; month: number }) {
  return (
    <>
      <span className="text-muted-foreground">
        Неделя: <span className="text-foreground font-medium">{week}</span>
      </span>
      <span className="text-muted-foreground">
        Месяц: <span className="text-foreground font-medium">{month}</span>
      </span>
    </>
  );
}
