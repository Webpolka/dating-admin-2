// app/(admin)/system/roles/_components/staff-table.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardHeader, CardTitle,
} from "@/components/ui/card";
import { UserBadge } from "@/components/admin/user-badge";
import { MiniPagination } from "@/components/admin/mini-pagination";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { getRoleBadge, ROLE_BADGES } from "@/lib/role-badge";
import { buildUrl } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { staffApi, type StaffMember, type StaffListResponse } from "@/lib/api/staff";
import { extractErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Save, UserMinus, Loader2 } from "lucide-react";
import { ROLES } from "./_shared";

export function StaffTable({
  page,
  onPageChange,
  urlInitialized,
}: {
  page: number;
  onPageChange: (page: number) => void;
  urlInitialized: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});

  // F2: placeholderData вместо deprecated keepPreviousData.
  const queryResult = useQuery<StaffListResponse>({
    queryKey: ["staff", page],
    queryFn: () => staffApi.getStaff(page),
    placeholderData: (prev) => prev,
  });

  const staffData = queryResult.data;
  const isLoadingStaff = queryResult.isLoading;
  const isFetchingStaff = queryResult.isFetching;
  const isError = queryResult.isError;
  const error = queryResult.error;

  // F9: per-row pending для demote.
  const [demotingIds, setDemotingIds] = useState<Set<number>>(new Set());

  // F10: URL-sync для ?page=N. buildUrl не оставляет голый «?»,
  // когда параметров нет.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, { page: page > 1 ? page : undefined }),
      { scroll: false },
    );
  }, [page, pathname, router, urlInitialized]);

  const demoteMutation = useMutation({
    mutationFn: (userId: number) => staffApi.demote(userId),
    onSuccess: (data) => {
      toast.info(data.message);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: unknown) => {
      // F3: extractErrorMessage из lib/api.
      toast.error(extractErrorMessage(err, "Ошибка при понижении"));
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (roles: Record<number, string>) => staffApi.batchUpdate(roles),
    onSuccess: (data) => {
      if (data.updated_count > 0) {
        toast.success(data.message);
      } else {
        toast.info(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      // Сбрасываем выбранные роли после сохранения.
      setSelectedRoles({});
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Ошибка сервера при сохранении!"));
    },
  });

  const hasChanges = staffData?.data?.some((member: StaffMember) => {
    if (member.is_founder || member.is_self) return false;
    return selectedRoles[member.id] !== undefined && selectedRoles[member.id] !== member.role;
  }) ?? false;

  const isFirstLoad = isLoadingStaff && !staffData?.data;
  const showEmpty = !isLoadingStaff && !isFetchingStaff && (!staffData?.data || staffData.data.length === 0) && !isError;

  const handleDemote = (userId: number) => {
    setDemotingIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
    demoteMutation.mutate(userId, {
      onSettled: () => {
        setDemotingIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Текущий персонал</CardTitle>
        <Button
          size="sm"
          variant={hasChanges ? "default" : "secondary"}
          onClick={() => batchUpdateMutation.mutate(selectedRoles)}
          disabled={!hasChanges || batchUpdateMutation.isPending}
        >
          {batchUpdateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          {hasChanges ? "Сохранить" : "Сохранено"}
        </Button>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              {/* B3: подпись "Дата регистрации" вместо "Дата назначения" */}
              <TableHead>Дата регистрации</TableHead>
              <TableHead className="text-right">Управление</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={5} />
            ) : isError ? (
              // F5: отдельная ветка ошибки загрузки.
              <TableErrorRow
                colSpan={5}
                title="Не удалось загрузить сотрудников"
                error={error}
                onRetry={() => queryResult.refetch()}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={5}
                title="Сотрудников нет"
                hint="Назначьте сотрудников через форму выше"
              />
            ) : (
              staffData?.data?.map((member: StaffMember, index: number) => {
                const roleBadge = getRoleBadge(member.role);
                const currentRoleValue = selectedRoles[member.id] || member.role;

                return (
                  <TableRow
                    key={member.id}
                    className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                    style={staggerStyle(index)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* F12: StaffMember наследует UserBadgeData — каст не нужен. */}
                        <UserBadge user={member} showEmail={false} />
                        {member.is_founder ? (
                          <Badge variant="outline" className={cn(ROLE_BADGES.admin.className, "text-xs ml-2")}>
                            Владелец
                          </Badge>
                        ) : member.is_self ? (
                          <Badge variant="secondary" className="text-xs ml-2">Вы</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      {member.is_founder || member.is_self ? (
                        <Badge variant="outline" className={`text-xs pointer-events-none ${roleBadge.className}`}>
                          Супер Админ
                        </Badge>
                      ) : (
                        <Select
                          value={currentRoleValue}
                          onValueChange={(value: string | null) => {
                            if (value) {
                              setSelectedRoles((prev) => ({ ...prev, [member.id]: value }));
                            }
                          }}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue>
                              {ROLES.find(r => r.value === currentRoleValue)?.label || "Выберите роль"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value} className="text-xs">
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {/* F14 + B3: форматирование через formatDateTime из lib/format,
                          т.к. бэкенд теперь отдаёт ISO. */}
                      {member.created_at ? formatDateTime(member.created_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.is_founder ? (
                        <span className="text-xs text-muted-foreground">
                          Защищен
                        </span>
                      ) : !member.is_self ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleDemote(member.id)}
                          disabled={demotingIds.has(member.id)}
                        >
                          {demotingIds.has(member.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <UserMinus className="w-3 h-3 mr-1" />
                          )}
                          Уволить
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Нельзя уволить себя</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Пагинация */}
      <div className="px-4">
        <MiniPagination
          currentPage={page}
          lastPage={staffData?.last_page ?? 1}
          from={null}
          to={null}
          total={staffData?.total ?? 0}
          onChangePage={onPageChange}
        />
      </div>
    </Card>
  );
}