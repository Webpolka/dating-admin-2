// app/(admin)/dashboard/_components/dashboard-kpis.tsx
//
// Карточки KPI дашборда. Конфигурация карточек описана данными
// (массивы ниже), рендерит всё KpiCard — вместо 13 копий одного
// и того же JSX с ветками по ролям.

import { Users, Image as ImageIcon, BookOpen, Flag, LifeBuoy, UserPlus } from "lucide-react";

import { KpiCard, KpiRange, type KpiTone } from "@/components/admin/kpi-card";
import type { DashboardStats } from "@/lib/api/dashboard";

interface DashboardKpisProps {
  stats: DashboardStats;
  role: string;
}

/** Общие карточки модерации для админа и модератора (без «Онлайн»). */
function moderationCards(stats: DashboardStats, diariesTone: KpiTone) {
  return [
    {
      label: "Модерация: Фото",
      value: stats.pendingPhotos + stats.pendingPhotoComments,
      icon: ImageIcon,
      tone: "yellow" as KpiTone,
      footer: (
        <span className="text-muted-foreground">
          {stats.pendingPhotos} фото / {stats.pendingPhotoComments} комм.
        </span>
      ),
    },
    {
      label: "Модерация: Дневники",
      value: stats.pendingDiaries + stats.pendingDiaryComments,
      icon: BookOpen,
      tone: diariesTone,
      footer: (
        <span className="text-muted-foreground">
          {stats.pendingDiaries} постов / {stats.pendingDiaryComments} комм.
        </span>
      ),
    },
    {
      label: "Жалобы (Ожидают)",
      value: stats.pendingReports,
      icon: Flag,
      tone: "red" as KpiTone,
      footer: <span className="text-muted-foreground">Ожидают обработки</span>,
    },
  ];
}

export function DashboardKpis({ stats, role }: DashboardKpisProps) {
  if (role === "admin") {
    const cards = [
      {
        label: "Новые юзеры (24ч)",
        value: `+${stats.newUsersToday}`,
        icon: Users,
        tone: "blue" as KpiTone,
        footer: <KpiRange week={stats.newUsersWeek} month={stats.newUsersMonth} />,
      },
      ...moderationCards(stats, "indigo"),
      {
        label: "Тикеты поддержки",
        value: stats.unreadTickets,
        icon: LifeBuoy,
        tone: "purple" as KpiTone,
        footer: <span className="text-muted-foreground">Непрочитанных сообщений</span>,
      },
      {
        label: "Онлайн сейчас",
        value: stats.onlineUsers,
        icon: Users,
        tone: "green" as KpiTone,
        pulse: true,
        footer: <KpiRange week={stats.newUsersWeek} month={stats.newUsersMonth} />,
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    );
  }

  if (role === "moderator") {
    const cards = [
      ...moderationCards(stats, "blue"),
      {
        label: "Онлайн сейчас",
        value: stats.onlineUsers,
        icon: Users,
        tone: "green" as KpiTone,
        pulse: true,
        footer: <span className="text-muted-foreground">+{stats.newUsersToday} новых за 24ч</span>,
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    );
  }

  if (role === "support") {
    const cards = [
      {
        label: "Непрочитанные тикеты",
        value: stats.unreadTickets,
        icon: LifeBuoy,
        tone: "red" as KpiTone,
        footer: <span className="text-muted-foreground">Требуют ответа</span>,
      },
      {
        label: "Новые юзеры (24ч)",
        value: `+${stats.newUsersToday}`,
        icon: UserPlus,
        tone: "blue" as KpiTone,
        footer: <span className="text-muted-foreground">За неделю: {stats.newUsersWeek}</span>,
      },
      {
        label: "Онлайн сейчас",
        value: stats.onlineUsers,
        icon: Users,
        tone: "green" as KpiTone,
        pulse: true,
        footer: <span className="text-muted-foreground">За неделю: +{stats.newUsersWeek}</span>,
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    );
  }

  return null;
}
