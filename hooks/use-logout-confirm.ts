"use client";

// hooks/use-logout-confirm.ts
//
// Общее состояние подтверждения выхода из админки.
//
// До выноса handleConfirmLogout (+ пара useState: диалог открыт /
// идёт выход) копировался байт-в-байт в components/admin/header.tsx и
// components/admin/app-sidebar.tsx. Теперь логика — здесь, компоненты
// держат только свой ConfirmDialog (различается размещение и подписи).
//
// Использование:
//
//   const { logoutOpen, setLogoutOpen, isLoggingOut, confirmLogout } =
//     useLogoutConfirm();
//
//   <button onClick={() => setLogoutOpen(true)}>Выйти</button>
//   <ConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen}
//     isLoading={isLoggingOut} onConfirm={confirmLogout} ... />

import { useState } from "react";
import { toast } from "sonner";

import { logout } from "@/store/auth-store";

export function useLogoutConfirm() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Реальный выход из админки.
   *
   * Вызывается ТОЛЬКО из confirm-dialog (не напрямую из кнопки хедера
   * или пункта меню сайдбара).
   *
   * logout() из store/auth-store.ts делает:
   *   1. POST /api/admin/logout (инвалидирует сессию на бэке)
   *   2. Сбрасывает Zustand store (user = null)
   *   3. window.location.href = "/login" — hard redirect, сносит кэш роутера
   *
   * ВАЖНО про finally: window.location.href запускает навигацию, но JS
   * продолжает выполняться до момента фактической замены страницы.
   * setIsLoggingOut(false) сработает, но реальный unmount произойдёт
   * чуть позже при навигации. На всякий случай оставляем finally,
   * чтобы не зависло состояние если навигация затянется.
   */
  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // После logout() всегда редирект на /login, дальше код не выполнится
      // в текущем JS-контексте — страница заменится.
    } catch (error) {
      // logout() внутри себя ловит ошибки и в finally всё равно редиректит.
      // Сюда попадём только если что-то совсем экзотическое сломалось
      // ДО api.post (например, store недоступен). Показываем toast,
      // не закрываем диалог — юзер может retry.
      console.error("Logout failed:", error);
      toast.error("Не удалось выйти", {
        description: "Попробуйте ещё раз или обновите страницу.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return { logoutOpen, setLogoutOpen, isLoggingOut, confirmLogout };
}
