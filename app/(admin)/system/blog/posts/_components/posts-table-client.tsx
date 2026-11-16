// app/(admin)/system/blog/posts/_components/posts-table-client.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useBlogPostsList,
  useBlogPostCounts,
  useDeleteBlogPost,
  useDuplicateBlogPost,
  useToggleBlogPostStatus,
  useArchiveBlogPost,
  useRestoreBlogPost,
  useBulkBlogPosts,
  useSetFeaturedBlogPost,
  type BlogStatusFilter,
  type BulkBlogAction,
  type BlogPostList,
} from "@/hooks/admin/use-blog-posts";
import { getInitialUrlParam, buildUrl } from "@/lib/url-params";
import { cn, staggerStyle } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { getStatusBadge, BLOG_POST_STATUS } from "@/config/status-badges";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Newspaper, Plus, X, Image as ImageIcon, Pin,
} from "lucide-react";
import { SEARCH_DEBOUNCE_MS, PER_PAGE, STATUS_FILTERS, BULK_ACTION_LABELS } from "./_shared";
import { PostRowActions } from "./post-row-actions";
import { ListPagination } from "@/components/admin/list-pagination";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput } from "@/components/admin/search-input";
import { StatusTabs } from "@/components/admin/status-tabs";
import {
  TableEmptyRow, TableErrorRow, TableLoadingRow,
} from "@/components/admin/table-states";
import { TableShell } from "@/components/admin/table-shell";

export function PostsTableClient() {
  const router = useRouter();
  const pathname = usePathname();

  // F2: initial state через getInitialUrlParam (после mount).
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkBlogAction | "">("");

  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPostList | null>(null);

  const [urlInitialized, setUrlInitialized] = useState(false);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Initial URL read.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(getInitialUrlParam("q"));
    setDebouncedSearch(getInitialUrlParam("q"));
    const urlStatus = getInitialUrlParam("status") as BlogStatusFilter;
    if (urlStatus && ["all", "published", "draft", "archived", "uncategorized"].includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
    setPage(parseInt(getInitialUrlParam("page") || "1", 10));
    setUrlInitialized(true);
  }, []);

  // URL-sync — shareable URLs. buildUrl не оставляет голый «?»,
  // когда фильтров нет.
  useEffect(() => {
    if (!urlInitialized) return;
    router.replace(
      buildUrl(pathname, {
        q: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page: page > 1 ? page : undefined,
      }),
      { scroll: false },
    );
  }, [search, statusFilter, page, pathname, router, urlInitialized]);

  // F4: debounce 400ms. Ручной таймер (не useDebouncedValue): он батчит
  // не только поиск, но и сброс страницы + сброс статус-фильтра при
  // поиске по ID — это одна атомарная операция, разводить её нельзя.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);

      if (search && /^\d+$/.test(search)) {
        setStatusFilter("all");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { data: countsData } = useBlogPostCounts();
  const counts = countsData?.data;

  const { data, isLoading, isFetching, isError, error, refetch } = useBlogPostsList({
    q: debouncedSearch,
    status: statusFilter,
    page,
    per_page: PER_PAGE,
  });

  const deleteMutation = useDeleteBlogPost();
  const duplicateMutation = useDuplicateBlogPost();
  const toggleMutation = useToggleBlogPostStatus();
  const archiveMutation = useArchiveBlogPost();
  const restoreMutation = useRestoreBlogPost();
  const bulkMutation = useBulkBlogPosts();
  const featureMutation = useSetFeaturedBlogPost();

  const posts: BlogPostList[] = useMemo(() => data?.data ?? [], [data]);

  const meta = data?.meta;
  // F7: isHighlightedId от debouncedSearch, не от search.
  // Раньше подсветка срабатывала до debounce (когда пост ещё не найден).
  const isHighlightedId = debouncedSearch && /^\d+$/.test(debouncedSearch)
    ? parseInt(debouncedSearch, 10)
    : null;

  useEffect(() => {
    if (highlightRowRef.current && isHighlightedId) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlightedId, posts]);

  const isFirstLoad = isLoading && !data;
  const isRefetching = isFetching && !isFirstLoad;
  const showEmpty = !isLoading && !isFetching && posts.length === 0 && !isError;

  const handleStatusFilterChange = (newStatus: BlogStatusFilter) => {
    setStatusFilter(newStatus);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelected(checked ? posts.map((p) => String(p.id)) : []);
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, String(id)] : prev.filter((s) => s !== String(id))
    );
  };

  const handleClearSelection = () => {
    setSelected([]);
    setSelectAll(false);
    setBulkAction("");
  };

  const handleApplyBulkClick = () => {
    if (!bulkAction || selected.length === 0) return;
    setBulkConfirmOpen(true);
  };

  const handleConfirmBulk = () => {
    if (!bulkAction || selected.length === 0) return;
    bulkMutation.mutate(
      {
        ids: selected.map((s) => parseInt(s, 10)),
        action: bulkAction,
        is_archive_tab: statusFilter === "archived",
      },
      {
        onSuccess: () => {
          setBulkConfirmOpen(false);
          handleClearSelection();
        },
        onError: () => setBulkConfirmOpen(false),
      }
    );
  };

  const handleConfirmDeletePost = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleDuplicate = (post: BlogPostList) => {
    duplicateMutation.mutate(post.id, {
      onSuccess: (newPost) => {
        if (newPost?.id) {
          router.push(`/system/blog/posts/${newPost.id}/edit`);
        }
      },
    });
  };

  const handleToggleFeatured = (post: BlogPostList) => {
    featureMutation.mutate(post.id);
  };

  const bulkActionLabel = bulkAction ? BULK_ACTION_LABELS[bulkAction] : null;
  const hasSelection = selected.length > 0;
  const isBulkDeleteWrongTab = bulkAction === "delete" && statusFilter !== "archived";

  const bulkConfirmTitle = isBulkDeleteWrongTab ? "Действие недоступно" : "Подтвердите действие";
  const bulkConfirmDescription = isBulkDeleteWrongTab
    ? 'Удалять посты можно только из вкладки «В архиве». Перейдите на нужную вкладку и повторите.'
    : `Применить «${bulkAction ? BULK_ACTION_LABELS[bulkAction] : ""}» к ${selected.length} постам?`;
  const bulkConfirmButton = isBulkDeleteWrongTab ? "Понятно" : "Применить";

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <PageHeader
        icon={Newspaper}
        title="Записи блога"
        onBack={() => router.back()}
        onRefresh={refetch}
        isFetching={isFetching}
        actions={
          <Link href="/system/blog/posts/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Написать пост
            </Button>
          </Link>
        }
      />

      {/* Filters + Bulk Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs
          tabs={STATUS_FILTERS}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          getCount={(v) => {
            const tab = STATUS_FILTERS.find((f) => f.value === v);
            return tab && counts ? counts[tab.countKey] : undefined;
          }}
        />

        <div className="flex items-center gap-5">
          {hasSelection && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium whitespace-nowrap">
                Выбрано: <span className="text-primary">{selected.length}</span>
              </span>
              <div className="w-px h-6 bg-border" />
              <Select
                value={bulkAction}
                onValueChange={(v: string | null) => setBulkAction((v ?? "") as BulkBlogAction | "")}
              >
                <SelectTrigger className="w-50">
                  {bulkActionLabel ? (
                    <span>{bulkActionLabel}</span>
                  ) : (
                    <span className="text-muted-foreground">Выберите действие...</span>
                  )}
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="publish">Опубликовать</SelectItem>
                  <SelectItem value="draft">В черновики</SelectItem>
                  <SelectItem value="archive">В архив</SelectItem>
                  {statusFilter === "archived" && (
                    <SelectItem value="delete" className="text-destructive focus:text-destructive">
                      Удалить навсегда
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleApplyBulkClick}
                disabled={!bulkAction || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? "Применяется..." : "Применить"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="w-4 h-4" /> Снять
              </Button>
            </div>
          )}

          <SearchInput
            value={search}
            onChange={(v) => {
              // Крестик очистки — мгновенный сброс поиска (как раньше).
              if (v === "") {
                handleClearSearch();
                return;
              }
              setSearch(v);
            }}
            placeholder="Поиск по названию или id..."
          />
        </div>
      </div>

      {/* Table */}
      <TableShell isFetching={isRefetching}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox checked={selectAll} onCheckedChange={(c) => handleSelectAll(Boolean(c))} />
              </TableHead>
              <TableHead className="w-10">ID</TableHead>
              <TableHead className="w-22">Обложка</TableHead>
              <TableHead>Заголовок</TableHead>
              <TableHead>Рубрика</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead>Обновлено</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirstLoad ? (
              <TableLoadingRow colSpan={9} />
            ) : isError ? (
              // F5: отдельная ветка ошибки загрузки.
              <TableErrorRow
                colSpan={9}
                title="Не удалось загрузить посты"
                error={error}
                onRetry={refetch}
              />
            ) : showEmpty ? (
              <TableEmptyRow
                colSpan={9}
                title="Посты не найдены"
                hint="Попробуйте изменить фильтр или поисковый запрос"
              />
            ) : (
              posts.map((post, index) => {
                const isHighlighted = post.id === isHighlightedId;
                const isSelected = selected.includes(String(post.id));

                const rowClassName = cn(
                  isHighlighted && "bg-primary/10",
                  !isHighlighted && isSelected && "bg-muted/30",
                  !isHighlighted && !isSelected && post.is_featured && "bg-yellow-500/5",
                );

                const statusBadge = getStatusBadge(BLOG_POST_STATUS, post.status);

                return (
                  <TableRow
                    key={post.id}
                    ref={isHighlighted ? highlightRowRef : undefined}
                    className={cn(
                      rowClassName,
                      "animate-in fade-in slide-in-from-bottom-1 duration-300",
                    )}
                    style={staggerStyle(index)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => handleSelectOne(post.id, Boolean(c))}
                      />
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-mono whitespace-nowrap",
                      isHighlighted ? "text-primary font-bold" : "text-muted-foreground",
                    )}>
                      #{post.id}
                    </TableCell>
                    <TableCell>
                      {post.cover_thumb ? (
                        <div className="w-16 h-9 rounded-[0.25rem] overflow-hidden bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.cover_thumb} alt="Cover" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-9 rounded-[0.25rem] bg-muted flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-48 md:max-w-88">
                        {post.is_featured && (
                          <span className="shrink-0 text-yellow-500" title="Закрепленный пост">
                            <Pin className="w-4 h-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => router.push(`/system/blog/posts/${post.id}/edit`)}
                            className="flex items-center gap-1 font-medium text-sm hover:text-primary hover:underline text-left"
                          >
                            <span className="truncate">{post.title}</span>
                          </button>
                          {post.excerpt && (
                            <div className="truncate text-xs text-muted-foreground mt-0.5">{post.excerpt}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.category ? (
                        <Badge variant="outline">{post.category.name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Без рубрики</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                      {formatDateTime(post.created_at)}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap tabular-nums">
                      {post.updated_at && post.created_at && post.updated_at !== post.created_at ? (
                        <span className="text-amber-600 dark:text-amber-500">
                          {formatDateTime(post.updated_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PostRowActions
                        post={post}
                        onEdit={() => router.push(`/system/blog/posts/${post.id}/edit`)}
                        onDuplicate={() => handleDuplicate(post)}
                        onToggleFeatured={() => handleToggleFeatured(post)}
                        onToggleStatus={() => toggleMutation.mutate(post.id)}
                        onArchive={() => archiveMutation.mutate(post.id)}
                        onRestore={() => restoreMutation.mutate(post.id)}
                        onDelete={() => setDeleteTarget(post)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableShell>

      <ListPagination
        currentPage={page}
        lastPage={meta?.last_page ?? 1}
        from={meta?.from ?? null}
        to={meta?.to ?? null}
        total={meta?.total}
        onChangePage={setPage}
        disabled={isFetching}
      />

      {/* Confirm: Bulk */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          setBulkConfirmOpen(open);
          if (!open && isBulkDeleteWrongTab) {
            setBulkAction("");
          }
        }}
        title={bulkConfirmTitle}
        description={bulkConfirmDescription}
        confirmText={bulkConfirmButton}
        cancelText={isBulkDeleteWrongTab ? "Закрыть" : "Отмена"}
        variant={bulkAction === "delete" ? "destructive" : "default"}
        isLoading={bulkMutation.isPending}
        onConfirm={
          isBulkDeleteWrongTab
            ? () => {
                setBulkConfirmOpen(false);
                setBulkAction("");
              }
            : handleConfirmBulk
        }
      />

      {/* Confirm: Delete Single */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Удалить пост навсегда?"
        description={
          deleteTarget
            ? `Пост «${deleteTarget.title}» будет удалён без возможности восстановления.`
            : undefined
        }
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDeletePost}
      />
    </div>
  );
}

