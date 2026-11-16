// components/admin/app-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LogOut, ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
  DropdownMenu, DropdownMenuGroup, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarFooter, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { navGroups } from "@/lib/navigation";
import type { NavItem } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import type { AdminUser } from "@/lib/types";
import { useLogoutConfirm } from "@/hooks/use-logout-confirm";
import { useSidebarCounts } from "@/hooks/admin/use-sidebar-counts";

function NavLinks({ items, userRole, counts }: { items: NavItem[]; userRole: string; counts: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        if (item.roles && !item.roles.includes(userRole as 'admin' | 'moderator' | 'support')) {
          return null;
        }

        const Icon = item.icon;
        // Проверяем активность (точно совпадает или начинается с href)
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

        // Реальный счётчик из статистики дашборда (use-sidebar-counts);
        // пока данных нет — бейдж не показываем.
        const count = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton isActive={isActive} tooltip={item.title}>
              <Link href={item.href} className="flex items-center gap-2 w-full">
                <Icon className="size-4" />
                <span>{item.title}</span>
                {count > 0 && (
                  <Badge 
                    variant={item.badgeType === 'destructive' ? 'destructive' : 'secondary'}
                    className={`ml-auto text-xs ${item.badgeType === 'pulse' ? 'animate-pulse' : ''}`}
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar({ user }: { user: AdminUser | null }) {
  const userRole = user?.is_founder ? 'admin' : user?.role || 'user';

  // Реальные счётчики очередей модерации для бейджей — тот же эндпоинт,
  // что и дашборд (/admin/dashboard/stats), опрос раз в 60с. Включён
  // только для admin/moderator: пункты меню с бейджами доступны только
  // этим ролям, а эндпоинт для support бесполезен.
  const counts = useSidebarCounts(userRole === 'admin' || userRole === 'moderator');

  // --- Состояние для ConfirmDialog "Выйти" ---
  // Логика выхода — в hooks/use-logout-confirm.ts (общая с хедером):
  // клик по пункту меню открывает диалог, реальный logout() — только
  // после confirm.
  const {
    logoutOpen: isLogoutConfirmOpen,
    setLogoutOpen: setIsLogoutConfirmOpen,
    isLoggingOut,
    confirmLogout: handleConfirmLogout,
  } = useLogoutConfirm();

  return (
    <>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="group-data-[collapsible=icon]:p-0">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Heart className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Dating Admin</span>
                <span className="truncate text-xs text-muted-foreground">Панель управления</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* ФИЛЬТР: Оставляем только те группы, где есть хотя бы 1 доступный пункт для текущей роли */}
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => {
            if (!item.roles) return true; // Если роли не указаны — доступно всем
            return item.roles.includes(userRole as 'admin' | 'moderator' | 'support');
          });

          // Если в группе нет доступных пунктов — не рендерим группу вообще (вместе с заголовком)
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavLinks items={visibleItems} userRole={userRole} counts={counts} />
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <SidebarMenuButton size="lg" className="hover:bg-transparent">
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarFallback className="rounded-lg">
                      {user?.name?.charAt(0).toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground capitalize">
                      {userRole}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              }/>              
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg">
                          {user?.name?.charAt(0).toUpperCase() || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user?.name}</span>
                        <span className="truncate text-xs">{user?.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsLogoutConfirmOpen(true)} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    {/* Confirm dialog для "Выйти" — симметрично хедеру.
        variant="default" (НЕ destructive) — выход обратим, юзер может
        залогиниться обратно. Красная кнопка была бы излишне алармистской.

        Порядок взаимодействия: клик по пункту "Выйти" в dropdown →
        dropdown auto-closes (стандартное поведение Radix UI) → setState
        открывает AlertDialog → фокус переходит к кнопке подтверждения.
        Radix корректно разруливает фокус между двумя overlays. */}
    <ConfirmDialog
      open={isLogoutConfirmOpen}
      onOpenChange={(open) => {
        // Не даём закрыть диалог во время запроса — иначе spinner останется
        // висеть на «висящем» диалоге. Юзер должен дождаться ответа или
        // отменить ДО отправки запроса.
        if (isLoggingOut && !open) return;
        setIsLogoutConfirmOpen(open);
      }}
      title="Выйти из админки?"
      description="Сессия будет завершена. Для продолжения работы потребуется заново ввести email и пароль."
      confirmText="Выйти"
      cancelText="Отмена"
      variant="default"
      isLoading={isLoggingOut}
      onConfirm={() => {
        void handleConfirmLogout();
      }}
    />
  </>
  );
}