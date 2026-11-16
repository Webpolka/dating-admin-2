// app/(admin)/moderation/diary-comments/_components/diary-comment-item.tsx
"use client";

// Тонкая обёртка над общей карточкой модерации комментария
// (components/admin/moderation-comment-card.tsx). Полная аналогия с
// comment-item.tsx из photo-comments: сюда приезжают только доменные
// хуки мутаций diary-comments и их константы причин отказа.
//
// Стратегия модерации (Вариант A): 3 статуса (pending / approved /
// rejected), спам — причина отказа, карантин — soft-deleted (trashed).
// Причины симметричны photo-comments: profanity / insult / off_topic /
// spam / other (+ системная parent_rejected).
// Подробное описание — в шапке moderation-comment-card.tsx.

import {
  useApproveDiaryComment,
  useRejectDiaryComment,
  useRestoreDiaryComment,
  useSoftDeleteDiaryComment,
  useDestroyDiaryComment,
  COMMENT_REJECT_REASONS,
  getCommentRejectReasonLabel,
  getCommentRejectReasonColor,
  type DiaryCommentItem,
} from "@/hooks/admin/use-diaries";
import {
  ModerationCommentCard,
  type ModerationCommentMutations,
} from "@/components/admin/moderation-comment-card";

/** Доменные мутации для карточки (своя копия инстансов на каждую карточку). */
function useDiaryCommentMutations(): ModerationCommentMutations {
  return {
    approve: useApproveDiaryComment(),
    reject: useRejectDiaryComment(),
    restore: useRestoreDiaryComment(),
    softDelete: useSoftDeleteDiaryComment(),
    destroy: useDestroyDiaryComment(),
  };
}

export function DiaryCommentItemRow({
  comment,
  searchedId,
  isKarantine,
  statusFilter,
  isReply = false,
}: {
  comment: DiaryCommentItem;
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
      useMutations={useDiaryCommentMutations}
      rejectReasons={COMMENT_REJECT_REASONS}
      getRejectReasonLabel={getCommentRejectReasonLabel}
      getRejectReasonColor={getCommentRejectReasonColor}
    />
  );
}
