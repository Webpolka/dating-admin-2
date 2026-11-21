"use client";

// app/(admin)/users/_components/users-page-client.tsx
//
// Страница /users — список пользователей.
// Фильтры синхронизируются с URL (?q=&status=&gender=&sub=&verified=&sort=&page=),
// чтобы ссылку на отфильтрованный список можно было расшарить.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Users, FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { ListPagination } from "@/components/admin/list-pagination";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useAdminUser } from "@/components/admin/admin-user-context";
import { buildUrl, getInitialUrlParam } from "@/lib/url-params";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useUsers, useUsersStats, useBanUser, useUnbanUser, useDeactivateUser, useRestoreUser } from "@/hooks/admin/use-users";
import type { AdminUserListItem, BanType, BanReason, DeletionReason } from "@/lib/api/users";
import { UsersTable } from "./users-table";
import { BanUserDialog } from "./ban-user-dialog";
import { DeactivateUserDialog } from "./deactivate-user-dialog";

// ============================================================
// Фильтры
// ============================================================

interface Filters {
  q: string;
  status: string;
  gender: string;
  sub: string;
  verified: string;
  sort: "asc" | "desc";
  page: number;
}

const DEFAULTS: Filters = { q: "", status: "", gender: "", sub: "", verified: "", sort: "desc", page: 1 };

const STATUS_OPTIONS: Record<string, string> = {
  all: "Все статусы",
  active: "Активные",
  banned: "Забанены",
  shadowbanned: "Теневой бан",
  deactivated: "Деактивированы",
};

const GENDER_OPTIONS: Record<string, string> = {
  all: "Любой пол",
  male: "Мужчины",
  female: "Женщины",
};

const SUB_OPTIONS: Record<string, string> = {
  all: "Подписки не учитывать",
  vip_only: "Только VIP",
  premium_only: "Только Premium",
  both: "VIP + Premium",
  none: "Без подписок",
};

const VERIFIED_OPTIONS: Record<string, string> = {
  all: "Верификацию не учитывать",
  yes: "Верифицированные",
  no: "Без верификации",
};

// ============================================================
// Состояния диалогов
// ============================================================

type BanState = { userId: number; type: BanType } | null;
type DeactivateState = { userId: number; userName: string } | null;
type ConfirmState = { action: "unban" | "restore"; user: AdminUserListItem } | null;

// ============================================================
// Компонент
// ============================================================

export function UsersPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const admin = useAdminUser();

  // Действия над юзерами доступны только admin/moderator (сверка с бэком:
  // группа admin.role:admin,moderator в routes/admin.php).
  const canManage = admin?.role === "admin" || admin?.role === "moderator";

  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [searchInput, setSearchInput] = useState("");
  const [hydrated, setHydrated] = useState(false); // ждём mount, читаем URL один раз

  const [banTarget, setBanTarget] = useState<BanState>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  // --- Первичная гидрация фильтров из URL ---
  useEffect(() => {
    const f: Filters = {
      q: getInitialUrlParam("q"),
      status: getInitialUrlParam("status"),
      gender: getInitialUrlParam("gender"),
      sub: getInitialUrlParam("sub"),
      verified: getInitialUrlParam("verified"),
      sort: getInitialUrlParam("sort") === "asc" ? "asc" : "desc",
      page: Math.max(1, Number(getInitialUrlParam("page")) || 1),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(f);
    setSearchInput(f.q);
    setHydrated(true);
  }, []);

  // --- Дебаунс поиска ---
  // Дебаунс здесь ручной (а не useDebouncedValue): таймер обязан одним
  // батчем применить и новый q, и сброс page на 1 — иначе между двумя
  // обновлениями состояния успеет уйти запрос со старой страницей.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, hydrated]);

  // --- Синхронизация фильтров → URL (replace, не push) ---
  // buildUrl выбрасывает пустые значения и не оставляет голый «?» в адресе.
  useEffect(() => {
    if (!hydrated) return;
    router.replace(
      buildUrl(pathname, {
        q: filters.q,
        status: filters.status,
        gender: filters.gender,
        sub: filters.sub,
        verified: filters.verified,
        sort: filters.sort === "asc" ? "asc" : undefined,
        page: filters.page > 1 ? filters.page : undefined,
      }),
      { scroll: false },
    );
  }, [filters, hydrated, pathname, router]);

  // --- Данные ---
  const { data, isLoading, isFetching } = useUsers(
    {
      q: filters.q || undefined,
      status: filters.status || undefined,
      gender: filters.gender || undefined,
      sub: filters.sub || undefined,
      verified: filters.verified || undefined,
      sort: filters.sort,
      page: filters.page,
    },
    hydrated,
  );
  const { data: stats } = useUsersStats();

  const ban = useBanUser();
  const unban = useUnbanUser();
  const deactivate = useDeactivateUser();
  const restore = useRestoreUser();

  const users = data?.data ?? [];
  const hasFilters = !!(filters.q || filters.status || filters.gender || filters.sub || filters.verified);
  const trimmedQ = filters.q.trim();
  const highlightId = /^\d+$/.test(trimmedQ) ? Number(trimmedQ) : null; // точный ID подсвечиваем

  // Патч фильтров; resetPage=true сбрасывает на 1-ю страницу (для фильтров,
  // но не для пагинации).
  const set = (patch: Partial<Filters>, resetPage = true) =>
    setFilters((f) => ({ ...f, ...patch, ...(resetPage ? { page: 1 } : {}) }));

  const resetFilters = () => {
    setSearchInput("");
    set({ q: "", status: "", gender: "", sub: "", verified: "" });
  };

  // --- Хендлеры мутаций ---

  const handleBanSubmit = (type: BanType, reason: BanReason, days?: number) => {
    if (!banTarget) return;
    ban.mutate(
      { userId: banTarget.userId, type, reason, days },
      { onSuccess: () => setBanTarget(null) },
    );
  };

  const handleDeactivateSubmit = (reason: DeletionReason) => {
    if (!deactivateTarget) return;
    deactivate.mutate(
      { userId: deactivateTarget.userId, reason },
      { onSuccess: () => setDeactivateTarget(null) },
    );
  };

  const handleConfirm = () => {
    if (!confirm) return;
    const opts = { onSuccess: () => setConfirm(null) };
    if (confirm.action === "unban") unban.mutate(confirm.user.id, opts);
    if (confirm.action === "restore") restore.mutate(confirm.user.id, opts);
  };

  const confirmConfig = {
    unban: {
      title: "Снять бан?",
      desc: (u: AdminUserListItem) => `Разблокировать ${u.name}?`,
      text: "Разбанить",
      variant: "default" as const,
    },
    restore: {
      title: "Восстановить аккаунт?",
      desc: (u: AdminUserListItem) => `Восстановить удалённый аккаунт ${u.name}?`,
      text: "Восстановить",
      variant: "default" as const,
    },
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <PageHeader
        icon={Users}
        title="Пользователи"
        badge={data && <span className="text-sm font-normal text-muted-foreground">(всего: {data.total})</span>}
        description="Управление аккаунтами, баны и модерация"
      />

      {/* Счётчики */}
      {stats && (
        <div className="flex items-center gap-6 flex-wrap text-xs text-muted-foreground">
          <span>Всего: <b className="text-foreground">{stats.total}</b></span>
          <span>Бан: <b className="text-red-500">{stats.banned}</b></span>
          <span>Теневой: <b className="text-yellow-500">{stats.shadowbanned}</b></span>
          <span>VIP: <b className="text-blue-500">{stats.vip}</b></span>
          <span>Premium: <b className="text-orange-500">{stats.premium}</b></span>
          <span>Верифицированы: <b className="text-sky-500">{stats.verified}</b></span>
        </div>
      )}

      {/* Фильтры + поиск */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filters.status || "all"} onValueChange={(v) => set({ status: v && v !== "all" ? v : "" })}>
            <SelectTrigger className="w-38">
              <SelectValue>
                {(v: string | null) => (v === null ? "Все статусы" : STATUS_OPTIONS[v] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.gender || "all"} onValueChange={(v) => set({ gender: v && v !== "all" ? v : "" })}>
            <SelectTrigger className="w-36">
              <SelectValue>
                {(v: string | null) => (v === null ? "Любой пол" : GENDER_OPTIONS[v] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GENDER_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.sub || "all"} onValueChange={(v) => set({ sub: v && v !== "all" ? v : "" })}>
            <SelectTrigger className="w-[14rem]">
              <SelectValue>
                {(v: string | null) => (v === null ? "Все подписки" : SUB_OPTIONS[v] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SUB_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.verified || "all"} onValueChange={(v) => set({ verified: v && v !== "all" ? v : "" })}>
            <SelectTrigger className="w-[16rem]">
              <SelectValue>
                {(v: string | null) => (v === null ? "Верификацию не учитывать" : VERIFIED_OPTIONS[v] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VERIFIED_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={resetFilters}>
              <FilterX className="w-4 h-4" /> Сбросить
            </Button>
          )}
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Имя, почта, телефон, ID, город..."
          className="w-72"
        />
      </div>

      {/* Таблица */}
      <UsersTable
        users={users}
        isLoading={isLoading}
        isFetching={isFetching}
        canManage={canManage}
        sort={filters.sort}
        highlightId={highlightId}
        hasFilters={hasFilters}
        onResetFilters={resetFilters}
        onToggleSort={() => set({ sort: filters.sort === "desc" ? "asc" : "desc" })}
        onBan={(user, type) => setBanTarget({ userId: user.id, type })}
        onUnban={(user) => setConfirm({ action: "unban", user })}
        onDeactivate={(user) => setDeactivateTarget({ userId: user.id, userName: user.name })}
        onRestore={(user) => setConfirm({ action: "restore", user })}
      />

      {/* Пагинация (скрывается целиком, если страница одна) */}
      {data && (
        <ListPagination
          currentPage={filters.page}
          lastPage={data.last_page}
          from={data.from}
          to={data.to}
          total={data.total}
          onChangePage={(page) => set({ page }, false)}
          disabled={isFetching}
        />
      )}

      {/* Диалог бана */}
      <BanUserDialog
        key={banTarget ? `ban-${banTarget.userId}` : "ban-closed"}
        target={banTarget}
        isPending={ban.isPending}
        onClose={() => setBanTarget(null)}
        onSubmit={handleBanSubmit}
      />

      {/* Диалог деактивации */}
      <DeactivateUserDialog
        key={deactivateTarget ? `deact-${deactivateTarget.userId}` : "deact-closed"}
        target={deactivateTarget}
        isPending={deactivate.isPending}
        onClose={() => setDeactivateTarget(null)}
        onSubmit={handleDeactivateSubmit}
      />

      {/* Подтверждение разбана / восстановления */}
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirmConfig[confirm.action].title}
          description={confirmConfig[confirm.action].desc(confirm.user)}
          confirmText={confirmConfig[confirm.action].text}
          variant={confirmConfig[confirm.action].variant}
          isLoading={unban.isPending || restore.isPending}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
