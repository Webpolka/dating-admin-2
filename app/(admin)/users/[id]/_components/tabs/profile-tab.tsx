"use client";

import {
  MessageSquare,
  User as UserIcon,
  Eye,
  HeartHandshake,
  Brush,
  Briefcase,
  Star,
  Languages,
  ShieldCheck,
  Server,
  Search,
  EyeOff,
  MessageCircle,
  Shield,
  Crown,
  Gem,
  BadgeCheck,
  SlidersHorizontal,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getOptionLabel,
  getArrayLabels,
  getGenderLabel,
  getZodiacLabel,
  getDatingGoals,
  getSearchFilterLabels,
  SELF_PORTRAIT_FIELDS,
} from "@/lib/profile-fields";
import { useUserDetail } from "@/hooks/admin/use-users";
import { TabLoading, TabError } from "@/components/admin/tab-states";
import { ClearFieldButton } from "../clear-field-button";

interface ProfileTabProps {
  userId: number;
}

export function ProfileTab({ userId }: ProfileTabProps) {
  const { data: user, isLoading, isError, refetch } = useUserDetail(userId);

  if (isLoading) return <TabLoading label="Загрузка анкеты…" />;
  if (isError) {
    return (
      <TabError
        label="Не удалось загрузить анкету"
        onRetry={() => refetch()}
      />
    );
  }
  if (!user) return <TabLoading label="Загрузка анкеты…" />;

  const profile = user.profile;
  const prefs = user.preferences;
  const datingGoals = getDatingGoals(profile?.dating_goals);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ЛЕВАЯ КОЛОНКА */}
      <div className="space-y-4">
        
        <h2>Личный профиль</h2>    
        {/* Тексты анкеты */}
        <Section icon={MessageSquare} title="Тексты анкеты">
          <div className="divide-y divide-border/50">
            <ProfileTextRow
              userId={user.id}
              field="headline"
              label="Заголовок"
              value={profile?.headline}
              confirmText="Очистить заголовок? Юзеру уйдет уведомление."
            />
            <ProfileTextRow
              userId={user.id}
              field="bio"
              label="О себе"
              value={profile?.bio}
              confirmText="Очистить поле 'О себе'? Юзеру уйдет уведомление."
            />
            <ProfileTextRow
              userId={user.id}
              field="looking_for"
              label="Кого я ищу"
              value={profile?.looking_for}
              confirmText="Очистить поле 'Кого я ищу'? Юзеру уйдет уведомление."
            />
          </div>
        </Section>

        {/* Основная информация */}
        <Section icon={UserIcon} title="Основная информация">
          <div className="divide-y divide-border/50">
            <InfoRow label="Пол" value={
              profile?.gender === "male" ? "Мужской"
              : profile?.gender === "female" ? "Женский"
              : <Empty />
            } />
            <InfoRow label="Возраст" value={profile?.age ? `${profile.age} лет` : <Empty />} />
            <InfoRow label="Дата рождения" value={
              profile?.birth_date
                ? new Date(profile.birth_date).toLocaleDateString("ru-RU")
                : <Empty />
            } />
            <InfoRow label="Страна" value={profile?.country ?? <Empty />} />
            <InfoRow label="Регион" value={profile?.state ?? <Empty />} />
            <InfoRow label="Город" value={profile?.city ?? <Empty />} />
            <InfoRow label="Адрес" value={profile?.address ?? <Empty />} />

            <InfoRow label="Цели знакомства" value={
              datingGoals.length > 0 ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {datingGoals.map((g) => (
                    <Badge key={g.value} variant="secondary" className="text-[10px]">
                      {g.label}
                    </Badge>
                  ))}
                </div>
              ) : <Empty />
            } />

            <InfoRow label="Знак зодиака" value={<OptionValue field="zodiac_sign" value={profile?.zodiac_sign} />} />
          </div>
        </Section>

        {/* Внешность */}
        <Section icon={Eye} title="Внешность">
          <div className="divide-y divide-border/50">
            <InfoRow label="Телосложение" value={<OptionValue field="body_type" value={profile?.body_type} />} />
            <InfoRow label="Цвет глаз" value={<OptionValue field="eye_color" value={profile?.eye_color} />} />
            <InfoRow label="Цвет волос" value={<OptionValue field="hair_color" value={profile?.hair_color} />} />
            <InfoRow label="Рост / Вес" value={
              <>
                {profile?.height ? `${profile.height} см` : <EmptyInline />} / {profile?.weight ? `${profile.weight} кг` : <EmptyInline />}
              </>
            } />
            <InfoRow label="Украшения / Особенности" value={
              <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                {getArrayLabels("body_decorations", profile?.body_decorations).map((label, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{label}</Badge>
                ))}
                {(!profile?.body_decorations || profile.body_decorations.length === 0) && <Empty />}
              </div>
            } />
          </div>
        </Section>

        {/* Личная жизнь и привычки */}
        <Section icon={HeartHandshake} title="Личная жизнь и привычки">
          <div className="divide-y divide-border/50">
            <InfoRow label="Семейное положение" value={<OptionValue field="relationship_status" value={profile?.relationship_status} />} />
            <InfoRow label="Дети" value={<OptionValue field="children_status" value={profile?.children_status} />} />
            <InfoRow label="Домашние животные" value={<OptionValue field="pets" value={profile?.pets} />} />
            <InfoRow label="Жилье" value={<OptionValue field="housing" value={profile?.housing} />} />
            <InfoRow label="Автомобиль" value={<OptionValue field="has_car" value={profile?.has_car} />} />
            <InfoRow label="Курение" value={<OptionValue field="smoking" value={profile?.smoking} />} />
            <InfoRow label="Алкоголь" value={<OptionValue field="alcohol" value={profile?.alcohol} />} />
          </div>
        </Section>

         {/* Работа и образование */}
        <Section icon={Briefcase} title="Работа и образование">
          <div className="divide-y divide-border/50">
            <InfoRow label="Образование" value={<OptionValue field="education_level" value={profile?.education_level} />} />
            <InfoRow label="С мат. положением" value={<OptionValue field="income" value={profile?.income} />} />
            <InfoRow label="Учебное заведение" value={profile?.institution ?? <Empty />} />
            <InfoRow label="Год выпуска" value={profile?.institution_year ?? <Empty />} />
            <InfoRow label="Сфера деятельности" value={profile?.activity ?? <Empty />} />
            <InfoRow label="Должность" value={profile?.position ?? <Empty />} />
          </div>
        </Section>

        {/* Интересы */}
        <Section icon={Star} title="Интересы">
          <div className="flex flex-wrap gap-1.5">
            {getArrayLabels("sports", profile?.sports).map((label, i) => (
              <Badge key={`sport-${i}`} variant="secondary" className="text-[10px]">{label}</Badge>
            ))}
            {profile?.interests?.map((interest) => (
              <Badge
                key={`interest-${interest.id ?? interest.slug}`}
                variant="secondary"
                className="text-[10px]"
              >
                {interest.name}
              </Badge>
            ))}
            {(!profile?.sports?.length && !profile?.interests?.length) && <Empty />}
          </div>
        </Section>

        {/* Языки */}
        <Section icon={Languages} title="Языки">
          <div className="flex flex-wrap gap-1.5">
            {getArrayLabels("languages", profile?.languages).map((label, i) => (
              <Badge key={`lang-${i}`} variant="secondary" className="text-[10px]">{label}</Badge>
            ))}
            {(!profile?.languages || profile.languages.length === 0) && <Empty />}
          </div>
        </Section>

        {/* Автопортрет — ВСЕГДА показываем все 19 полей. */}
        <Section icon={Brush} title="Автопортрет">
          <SelfPortraitView data={profile?.self_portrait ?? null} />
        </Section>
      </div>

      {/* ПРАВАЯ КОЛОНКА */}
      <div className="space-y-4">   

        <h2>Система</h2>    

        {/* Статусы аккаунта */}
        <Section icon={ShieldCheck} title="Статусы аккаунта">
          <div className="grid grid-cols-2 gap-4">
            <StatusItem
              label="Premium"
              active={user.has_active_premium}
              activeText={user.premium_expires_at
                ? `До ${new Date(user.premium_expires_at).toLocaleDateString("ru-RU")}`
                : "Активен"
              }
              activeIcon={<Crown className="w-3 h-3 inline !text-orange-500" />}
            />
            <StatusItem
              label="VIP"
              active={user.has_active_vip}
              activeText={user.vip_expires_at
                ? `До ${new Date(user.vip_expires_at).toLocaleDateString("ru-RU")}`
                : "Активен"
              }
              activeIcon={<Gem className="w-3 h-3 inline !text-blue-500" />}
            />
            <StatusItem
              label="Верификация"
              active={user.is_verified}
              activeText="Верифицирован"
              inactiveText="Не верифицирован"
              activeIcon={<BadgeCheck className="w-3 h-3 inline !text-sky-500" />}
            />
            <StatusItem
              label="Онбординг"
              active={user.has_completed_onboarding}
              activeText="Пройден"
              inactiveText="Не завершён"
            />
            <StatusItem
              label="Email"
              active={!!user.email_verified_at}
              activeText="Подтверждён"
              inactiveText="Не подтверждён"
            />
            <StatusItem
              label="Телефон"
              active={!!user.phone}
              activeText="Подтверждён"
              inactiveText="Нет"
            />
          </div>
        </Section>

        {/* Системные данные */}
        <Section icon={Server} title="Системные данные">
          <div className="divide-y divide-border/50">
            <InfoRow label="Регистрация" value={
              user.created_at ? new Date(user.created_at).toLocaleString("ru-RU") : <Empty />
            } />
            <InfoRow label="Последний визит" value={
              user.is_online ? (
                <span className="text-green-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> В сети
                </span>
              ) : user.last_seen ? (
                new Date(user.last_seen).toLocaleString("ru-RU")
              ) : <Empty />
            } />
            <InfoRow label="IP (последний)" value={
              user.last_login_ip ? (
                <span className="font-mono">{user.last_login_ip}</span>
              ) : <Empty />
            } />
            <InfoRow label="Телефон" value={
              user.phone ? (
                <span className="font-mono">{user.phone}</span>
              ) : <Empty />
            } />
          </div>
        </Section>

        {/* Настройки поиска */}
        <Section icon={Search} title="Настройки поиска">
          <div className="divide-y divide-border/50">
            <InfoRow label="Искомый пол" value={getGenderLabel(prefs?.preferred_gender) ?? <Empty />} />
            <InfoRow label="Возраст" value={`${prefs?.preferred_age_min ?? 18} - ${prefs?.preferred_age_max ?? 99}`} />
            <InfoRow label="Радиус поиска" value={
              prefs?.preferred_distance_km ? `${prefs.preferred_distance_km} км` : "Не ограничен"
            } />
          </div>

          {/* Дополнительные фильтры — ВСЕГДА показываем блок.
              ВАЖНО: проверяем длину labels (после фильтрации falsy), а не
              Object.keys(search_filters).length — бек отдаёт DEFAULT_SEARCH_FILTERS
              (9 ключей, все null/false) через accessor array_merge → Object.keys
              всегда > 0, но getSearchFilterLabels фильтрует falsy → может быть пусто. */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Дополнительные фильтры:</p>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const labels = prefs?.search_filters
                  ? getSearchFilterLabels(prefs.search_filters as Record<string, unknown>)
                  : [];
                return labels.length > 0 ? (
                  labels.map((label, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{label}</Badge>
                  ))
                ) : <Empty />;
              })()}
            </div>
          </div>
        </Section>

        {/* Настройки видимости */}
        <Section icon={EyeOff} title="Настройки видимости">
          <div className="divide-y divide-border/50">
            <InfoRow label="Виден для пола" value={getGenderLabel(prefs?.visibility_gender) ?? <Empty />} />
            <InfoRow label="Виден для возраста" value={`${prefs?.visibility_age_min ?? 18} - ${prefs?.visibility_age_max ?? 99}`} />
          </div>
        </Section>

        {/* Настройки чата */}
        <Section icon={MessageCircle} title="Настройки чата">
          <div className="divide-y divide-border/50">
            <InfoRow label="Фильтр сообщений" value={
              <BooleanBadge active={!!prefs?.chat_filter_enabled} />
            } />
            <InfoRow label="Принимать от пола" value={
              prefs?.chat_filter_enabled && prefs.chat_filter_settings?.gender
                ? getGenderLabel(prefs.chat_filter_settings.gender)
                : <Empty />
            } />
            <InfoRow label="Возраст" value={
              prefs?.chat_filter_enabled && prefs.chat_filter_settings
                ? `${prefs.chat_filter_settings.age_from ?? 18} - ${prefs.chat_filter_settings.age_to ?? 99}`
                : <Empty />
            } />
            <InfoRow label="Только верифицированные" value={
              <BooleanBadge active={
                !!(prefs?.chat_filter_enabled && prefs.chat_filter_settings?.is_verified_only)
              } />
            } />
            <InfoRow label="Только VIP" value={
              <BooleanBadge active={
                !!(prefs?.chat_filter_enabled && prefs.chat_filter_settings?.is_premium_only)
              } />
            } />
          </div>
        </Section>

        {/* Настройки приватности */}
        <Section icon={Shield} title="Настройки приватности">
          <div className="divide-y divide-border/50">
            <InfoRow label="Невидимка (VIP)" value={
              <BooleanBadge active={!!prefs?.is_invisible} />
            } />
            <InfoRow label="Скрыт из поиска" value={
              <BooleanBadge active={!!prefs?.hide_from_search} />
            } />
            <InfoRow label="Скрывать 18+ фото" value={
              <BooleanBadge active={!!prefs?.hide_intimate} />
            } />
            <InfoRow label="Запрет коммент. фото" value={
              <BooleanBadge active={!!prefs?.disable_photo_comments} />
            } />
          </div>
        </Section>

        {/* Настройки интерфейса */}
        <Section icon={SlidersHorizontal} title="Настройки интерфейса">
          <div className="divide-y divide-border/50">
            <InfoRow label="Язык" value={prefs?.locale ?? <Empty />} />
            <InfoRow label="Тема" value={
              prefs?.theme === "dark" ? "Тёмная"
              : prefs?.theme === "light" ? "Светлая"
              : prefs?.theme ?? <Empty />
            } />
            <InfoRow label="Виджет чата" value={
              <BooleanBadge active={!!prefs?.chat_widget_enabled} />
            } />
            <InfoRow label="Звук чата" value={
              <BooleanBadge active={!!prefs?.chat_sound_enabled} />
            } />
            <InfoRow label="Быстрые ответы" value={
              <BooleanBadge active={!!prefs?.show_quick_replies} />
            } />
          </div>
        </Section>

        {/* Настройки уведомлений */}
        <Section icon={Bell} title="Настройки уведомлений">
          <div className="divide-y divide-border/50">
            <InfoRow label="Push-уведомления" value={
              <BooleanBadge active={!!prefs?.push_enabled} />
            } />
            <InfoRow label="Email-уведомления" value={
              <BooleanBadge active={!!prefs?.email_enabled} />
            } />
            <InfoRow label="Push авто-рекомендации" value={
              <BooleanBadge active={!!prefs?.push_auto_recommendations} />
            } />
            <InfoRow label="Email авто-рекомендации" value={
              <BooleanBadge active={!!prefs?.email_auto_recommendations} />
            } />
            <InfoRow label="Разрешить авто-сообщения" value={
              <BooleanBadge active={!!prefs?.allow_auto_messages} />
            } />
          </div>

          {/* Email по событиям — ВСЕГДА показываем.
              Сортировка: сначала активные (подсвеченные), потом приглушённые. */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Email по событиям:</p>
            <div className="flex flex-wrap gap-1.5">
              {prefs?.email_settings && Object.keys(prefs.email_settings).length > 0 ? (
                Object.entries(prefs.email_settings)
                  .sort(([, a], [, b]) => (a === b ? 0 : a ? -1 : 1))
                  .map(([key, enabled]) => (
                    <Badge
                      key={key}
                      variant="secondary"
                      className={`text-[10px] ${!enabled ? "opacity-40" : ""}`}
                    >
                      {EMAIL_EVENT_LABELS[key] ?? key}
                    </Badge>
                  ))
              ) : <Empty />}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ============================================
// Человекочитаемые labels для email_settings
// (sync с UserPreference::DEFAULT_EMAIL_SETTINGS)
// ============================================
const EMAIL_EVENT_LABELS: Record<string, string> = {
  on_message: "Сообщения",
  on_like: "Лайки",
  on_view: "Просмотры",
  on_gift: "Подарки",
  on_event: "События",
  on_broadcast: "Рассылки",
  sub_new_faces: "Новые анкеты",
  sub_popular: "Популярные",
};

// ============================================
// Вспомогательные компоненты
// ============================================

/** "нет ответа" серым italic — единый стиль для всех пустых значений. */
function Empty() {
  return <span className="text-muted-foreground/50 italic">нет ответа</span>;
}

/** Инлайн-версия для составных значений (например "Рост / Вес"). */
function EmptyInline() {
  return <span className="text-muted-foreground/50 italic">—</span>;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-muted/20 rounded-lg border border-border">
      <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function ProfileTextRow({
  userId,
  field,
  label,
  value,
  confirmText,
}: {
  userId: number;
  field: "headline" | "bio" | "looking_for";
  label: string;
  value: string | null | undefined;
  confirmText: string;
}) {
  return (
    <div className="py-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
        {value && (
          <ClearFieldButton
            userId={userId}
            field={field}
            label="Удалить"
            confirmText={confirmText}
          />
        )}
      </div>
      <p className={`text-sm ${value ? "text-foreground font-medium" : "text-muted-foreground/50 italic"}`}>
        {value ? `"${value}"` : "нет ответа"}
      </p>
    </div>
  );
}

/**
 * Опция из config/profile_fields.php — если value=0/null → "нет ответа".
 * Иначе — label из getOptionLabel.
 */
function OptionValue({ field, value }: { field: string; value: number | null | undefined }) {
  if (!value) return <Empty />;
  return <>{getOptionLabel(field, value)}</>;
}

/**
 * StatusItem — бейдж статуса аккаунта.
 * activeIcon показывается ТОЛЬКО если active (подписка активна / верифицирован).
 * Если inactive — иконки нет, просто текст.
 */
function StatusItem({
  label,
  active,
  activeText,
  inactiveText = "Нет",
  activeIcon,
}: {
  label: string;
  active: boolean;
  activeText: string;
  inactiveText?: string;
  activeIcon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Badge variant={active ? "success" : "secondary"} className="text-[10px]">
        {active && activeIcon}
        {active ? activeText : inactiveText}
      </Badge>
    </div>
  );
}

/**
 * BooleanBadge — Да/Нет. Да=зелёный, Нет=серый.
 * Убрал warning/destructive/successOnFalse — теперь единый стиль: Да=success, Нет=secondary.
 */
function BooleanBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "secondary"} className="text-[10px]">
      {active ? "Да" : "Нет"}
    </Badge>
  );
}

/**
 * Отображение self_portrait — таблица всех 19 полей.
 * Слева label (w-1/3), справа значение (flex-1).
 * Если значение не заполнено → "нет ответа" серым italic.
 */
function SelfPortraitView({ data }: { data: Record<string, string> | null }) {
  return (
    <div className="divide-y divide-border/50">
      {SELF_PORTRAIT_FIELDS.map(({ key, label }) => {
        const value = data?.[key];
        const hasValue = value && String(value).trim() !== "";
        return (
          <div key={key} className="flex py-1.5 gap-3 items-baseline">
            <span className="text-xs text-muted-foreground shrink-0 w-1/3">
              {label}
            </span>
            <span className={`text-sm flex-1 text-right ${hasValue ? "font-medium" : "text-muted-foreground/50 italic"}`}>
              {hasValue ? value : "нет ответа"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
