// lib/utils.ts
//
// Общие утилиты фронтенда. cn реэкспортируется из пакета «cn» —
// импортировать нужно отсюда (@/lib/utils), а не из пакета напрямую
// (в проекте находились оба варианта импорта).

import type { CSSProperties } from "react";

export { cn } from "cn";

/**
 * Стиль ступенчатого появления строк таблицы: каждая следующая строка
 * стартует чуть позже. Заменяет копипасту
 * style={{ animationDelay: ..., animationFillMode: "backwards" }},
 * жившую инлайном в ~20 строковых компонентах.
 */
export function staggerStyle(index: number): CSSProperties {
  return {
    animationDelay: `${Math.min(index * 15, 400)}ms`,
    animationFillMode: "backwards",
  };
}
