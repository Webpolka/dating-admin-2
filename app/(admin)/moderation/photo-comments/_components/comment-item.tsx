// app/(admin)/moderation/photo-comments/_components/comment-item.tsx
"use client";

// Тонкая обёртка над общей карточкой модерации комментария
// (components/admin/moderation-comment-card.tsx). Вся разметка и логика
// (canAct, parent-guards, dimmed, dropdown причин, ConfirmDialog) —
// в shared-карточке; сюда приезжают только доменные хуки мутаций
// photo-comments и их константы причин отказа.
//
// Стратегия модерации (Вариант A): 3 статуса (pending / approved /
// rejected), спам — причина отказа, карантин — soft-deleted (trashed).
// Подробное описание — в шапке moderation-comment-card.tsx.

import {
  useApproveComment,
  useRejectComment,
  useRestoreComment,
  useSoftDeleteComment,
  useDestroyComment,
  COMMENT_REJECT_REASONS,
  getCommentRejectReasonLabel,
  getCommentRejectReasonColor,
  type PhotoCommentItem,
} from "@/hooks/admin/use-photo-comments";
import {
  ModerationCommentCard,
  type ModerationCommentMutations,
} from "@/components/admin/moderation-comment-card";

/** Доменные мутации для карточки (своя копия инстансов на каждую карточку). */
function usePhotoCommentMutations(): ModerationCommentMutations {
  return {
    approve: useApproveComment(),
    reject: useRejectComment(),
    restore: useRestoreComment(),
    softDelete: useSoftDeleteComment(),
    destroy: useDestroyComment(),
  };
}

export function CommentItem({
  comment,
  searchedId,
  isKarantine,
  statusFilter,
  isReply = false,
}: {
  comment: PhotoCommentItem;
  searchedId: number | null;
  isKarantine: boolean;
  statusFilter: string;
  isReply?: boolean;
}) {
  return (
    <ModerationCommentCard
      comment={comment}
      searchedId={searchedId}
      isKarantine={isKarantine}
      statusFilter={statusFilter}
      isReply={isReply}
      useMutations={usePhotoCommentMutations}
      rejectReasons={COMMENT_REJECT_REASONS}
      getRejectReasonLabel={getCommentRejectReasonLabel}
      getRejectReasonColor={getCommentRejectReasonColor}
    />
  );
}
