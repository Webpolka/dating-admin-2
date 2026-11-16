// components/admin/city-combobox.tsx
"use client";

// Комбобокс поиска города (geo/search). Данные — через фабричный
// useAdminListQuery (React Query: кэш + ретраи), ввод — с debounce
// через useDebouncedValue. До перехода здесь был сырой api.get +
// ручной setTimeout(300) и молчаливый catch с console.error.

import { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";

import { useAdminListQuery } from "@/hooks/admin/use-admin-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

interface GeoResult {
  id: number;
  type: "city" | "country";
  label: string;
}

interface CityComboboxProps {
  value: { id: string; type: string; label: string };
  onChange: (value: { id: string; type: string; label: string }) => void;
  disabled?: boolean;
  className?: string;
}

export function CityCombobox({
  value,
  onChange,
  disabled = false,
  className,
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);

  useEffect(() => {
    if (open && triggerRef.current) {
      setDropdownWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  // Поиск с debounce; запрос уходит только от 2 символов.
  const debounced = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const isEnabled = debounced.length >= 2;

  const { data, isFetching } = useAdminListQuery<{ q: string }, GeoResult[]>(
    ["geo", "cities"],
    "/geo/search",
    { q: debounced },
    { enabled: isEnabled },
  );

  // Короткий запрос (< 2 символов) — дропдаун пуст, независимо от кэша.
  const results: GeoResult[] = isEnabled ? data ?? [] : [];

  // Ищем либо когда ждём debounce (пользователь печатает), либо когда
  // запрос в полёте. Ошибки не показываем — пустой дропдаун (React
  // Query сам ретраит; молчаливый UX сохранён со старой реализацией).
  const isSearching = (search !== debounced && search.length >= 2) || (isEnabled && isFetching);

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          ref={triggerRef}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-between w-full rounded-lg border border-input bg-secondary px-4 py-2 text-sm font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {value.label ? (
              <>
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{value.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Выберите город</span>
            )}
          </div>

          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value.label && !disabled ? (
              <span
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ id: "", type: "", label: "" });
                }}
              >
                <X className="w-4 h-4" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </PopoverTrigger>

        <PopoverContent style={{ width: dropdownWidth }} className="p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Начните вводить..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isSearching && <div className="p-2 text-sm text-center text-muted-foreground">Поиск...</div>}
              {!isSearching && debounced.length >= 2 && results.length === 0 && (
                <CommandEmpty>Ничего не найдено.</CommandEmpty>
              )}
              {!isSearching && results.length > 0 && (
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      onSelect={() => {
                        onChange({ id: String(item.id), type: item.type, label: item.label });
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value.id === String(item.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
