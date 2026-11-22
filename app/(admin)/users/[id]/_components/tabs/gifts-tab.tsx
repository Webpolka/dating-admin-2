"use client";

// app/(admin)/users/[id]/_components/tabs/gifts-tab.tsx
//
// Таб «Подарки»: двухколоночный layout — отправленные (слева) и полученные (справа).
// Паттерн как blocks-tab: две независимые пагинации (?sent_page=N&received_page=N).
//
// Бекенд: GET /admin/users/{userId}/gifts?filter=sent&page=N
//         GET /admin/users/{userId}/gifts?filter=received&page=N
// Два запроса с разными filter — каждый со своей пагинацией.

import { ArrowUpRight, ArrowDownLeft, Gift, EyeOff, ImageOff } from "lucide-react";
import Link from "next/link";

import { MiniPagination } from "@/components/admin/mini-pagination";
import { TabError, TabLoading } from "@/components/admin/tab-states";
import { UserBadge } from "@/components/admin/user-badge";
import { Badge } from "@/components/ui/badge";
import { useTabUrl, parsePageParam } from "@/hooks/admin/use-tab-url";
import { useUserGifts } from "@/hooks/admin/use-users";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import type { UserBadgeData } from "@/lib/types";
import type { UserGiftTabItem } from "@/lib/api/users";

interface GiftsTabProps {
  userId: number;
}

export function GiftsTab({ userId }: GiftsTabProps) {
  const basePath = `/users/${userId}/gifts`;
  const { searchParams, replace } = useTabUrl(basePath);

  const sentPage = parsePageParam(searchParams, "sent_page");
  const receivedPage = parsePageParam(searchParams, "received_page");

  const sentQuery = useUserGifts(userId, { filter: "sent", page: sentPage });
  const receivedQuery = useUserGifts(userId, { filter: "received", page: receivedPage });

  const isLoading = sentQuery.isLoading || receivedQuery.isLoading;
  const isError = sentQuery.isError || receivedQuery.isError;

  if (isLoading) return <TabLoading label="Загрузка подарков..." />;
  if (isError) return <TabError label="Не удалось загрузить подарки" onRetry={() => { sentQuery.refetch(); receivedQuery.refetch(); }} />;
  if (!sentQuery.data || !receivedQuery.data) return <TabLoading label="Загрузка подарков..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GiftsColumn
          title="Отправленные подарки:"
          icon={ArrowUpRight}
          iconColor="text-blue-500"
          paginator={sentQuery.data}
          onChangePage={(p) =>
            replace((params) => (p <= 1 ? params.delete("sent_page") : params.set("sent_page", String(p))))
          }
          emptyText="Пользователь еще никому не дарил подарков."
        />

        <GiftsColumn
          title="Полученные подарки:"
          icon={ArrowDownLeft}
          iconColor="text-destructive"
          paginator={receivedQuery.data}
          onChangePage={(p) =>
            replace((params) => (p <= 1 ? params.delete("received_page") : params.set("received_page", String(p))))
          }
          emptyText="Пользователь не получал подарков."
        />
      </div>

      <div className="text-xs text-muted-foreground">
        <Gift className="w-3.5 h-3.5 inline mr-1" />
        <Link href="/finance/gifts" className="hover:text-foreground underline underline-offset-2">
          Управлять подарками в разделе «Финансы → Подарки»
        </Link>
      </div>
    </div>
  );
}

// ============================================
// КОЛОНКА ПОДАРКОВ
// ============================================

function GiftsColumn({
  title,
  icon: Icon,
  iconColor,
  paginator,
  onChangePage,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  paginator: { data: UserGiftTabItem[]; total: number; current_page: number; last_page: number; from: number | null; to: number | null; per_page: number };
  onChangePage: (page: number) => void;
  emptyText: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {title} &nbsp; {paginator.total}
      </h3>

      {paginator.data.length === 0 ? (
        <div className="p-4 bg-muted/20 rounded-lg border border-border text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginator.data.map((g) => (
              <GiftRow key={g.id} item={g} />
            ))}
          </div>

          <MiniPagination
            currentPage={paginator.current_page}
            lastPage={paginator.last_page}
            from={paginator.from}
            to={paginator.to}
            total={paginator.total}
            onChangePage={onChangePage}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// СТРОКА ПОДАРКА — по шаблону ReportRow
// ============================================

function GiftRow({ item }: { item: UserGiftTabItem }) {
  // В двухколоночном layout направление уже определяется колонкой.
  // counterpart: sent → receiver, received → sender.
  const counterpart = item.direction === "sent" ? item.receiver : item.sender;
  const isSent = item.direction === "sent";

  return (
    <div className={`p-3 bg-card border border-border rounded-lg space-y-2 ${item.is_hidden ? "opacity-50" : ""}`}>
      {/* Шапка: Gift # (каталог) + UserGift # (история) + badges + дата справа */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {/* Gift # → каталог подарков (по gift.id) */}
        {item.gift ? (
          <Link
            href={`/finance/gifts?tab=catalog&q=${item.gift.id}`}
            className="font-mono text-blue-500 hover:underline shrink-0"
            title="Открыть в каталоге подарков"
          >
            Gift #{item.gift.id}
          </Link>
        ) : (
          <span className="font-mono text-muted-foreground/50 shrink-0" title="Подарок удалён из каталога">
            Gift удалён
          </span>
        )}

        {/* UserGift # → история дарений (по item.id) */}
        <Link
          href={`/finance/gifts?tab=history&q=${item.id}`}
          className="font-mono text-blue-500 hover:underline shrink-0"
          title="Открыть в истории дарений"
        >
          UserGift #{item.id}
        </Link>

        {/* Бейджи статусов */}
        <div className="flex flex-wrap items-center gap-1.5" title="Статус подарка">
          {isSent ? (
            item.is_private ? (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">Приватный</Badge>
            ) : (
              <Badge variant="success" className="text-xs px-1.5 py-0">Публичный</Badge>
            )
          ) : item.is_read ? (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">Прочитан</Badge>
          ) : (
            <Badge variant="warning" className="text-xs px-1.5 py-0">Не прочитан</Badge>
          )}
          {item.is_hidden && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 gap-1">
              <EyeOff className="w-3 h-3" /> Скрыт
            </Badge>
          )}
        </div>

          {/* Тип + категория подарка (из каталога) */}
            {item.gift && (
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs px-1.5 py-0" title="Тип подарка">
                  {item.gift.type === "main" ? "Основной"
                    : item.gift.type === "premium" ? "Премиум"
                    : item.gift.type === "services" ? "Услуга"
                    : item.gift.type}
                </Badge>
                {item.gift.category_label && (
                  <span title="Категория подарка"
                    className={`text-xs font-medium px-1.5 py-0 rounded ${item.gift.category_color ?? "bg-muted text-muted-foreground"}`}
                  >
                    {item.gift.category_label}
                  </span>
                )}
              </div>
            )}

        {item.created_at && (
          <span title={formatDateTime(item.created_at)} className="ml-auto whitespace-nowrap">
            {formatRelativeTime(item.created_at)}
          </span>
        )}
      </div>

      {/* Тело: подарок (image + name + price) слева, counterpart справа */}
      <div className="flex justify-between items-center gap-3">
        {/* Левая часть: image + name + price */}
        <div className="flex items-center gap-3 min-w-0">
          {item.snapshot_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.snapshot_image_url}
              alt={item.snapshot_name}
              className="w-12 h-12 rounded-md object-cover bg-muted shrink-0"
            />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center rounded-md bg-muted border border-dashed border-border shrink-0">
              <ImageOff className="w-4 h-4 text-muted-foreground/50" />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-md font-medium block truncate">
              {item.snapshot_name || "Подарок удалён"}
            </span>
            <span className="text-sm font-medium text-muted-foreground" >
              {item.snapshot_price} ед.
            </span>          
          </div>
        </div>
     

        {/* Правая часть: counterpart */}
        <div className="flex items-center gap-2 shrink-0">
          {counterpart ? (
            <Link href={`/users/${counterpart.id}`} className="hover:opacity-80 transition-opacity">
              <UserBadge user={counterpart as UserBadgeData} size="sm" />
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground italic">Удалён</span>
          )}
        </div>
      </div>

      {/* Подвал: только сообщение (badges уже в шапке) */}
      {item.message && (
        <div className="border-t border-border/50 pt-1.5">
          <p className="text-xs text-muted-foreground italic truncate" title={item.message}>
            «{item.message}»
          </p>
        </div>
      )}
    </div>
  );
}
