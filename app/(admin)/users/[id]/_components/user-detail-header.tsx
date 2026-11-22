"use client";

import { ArrowLeft, Mail, MapPin } from "lucide-react";
import { UserBadge } from "@/components/admin/user-badge";
import { HeaderActionsMenu } from "./header-actions-menu";
import type { UserDetail } from "@/lib/api/users";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UserDetailHeaderProps {
  user: UserDetail;
}

export function UserDetailHeader({ user }: UserDetailHeaderProps) {
  // Локация: собираем из profile.country / state / city (любое может быть null).
  const locationParts = [
    user.profile?.country,
    user.profile?.state,
    user.profile?.city,
  ].filter(Boolean) as string[];
  const hasLocation = locationParts.length > 0;

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => history.back()}
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* UserBadge + локация справа (в одну строку, с отступом) */}
        <UserBadge user={user} size="md" showEmail={true} />
       
      </div>

      <div className="flex items-center gap-2 shrink-0">
         {hasLocation && (
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 ml-2 whitespace-nowrap">
            <MapPin className="w-4 h-4 shrink-0 text-primary" />
            {locationParts.join(", ")}
          </span>
        )}

        <a
          href={`mailto:${user.email}`}
           className={cn(buttonVariants({ variant: "outline", size: "sm" }))}          
        >
          <Mail className="w-4 h-4" />Написать Email
        </a>

        <HeaderActionsMenu user={user} />
      </div>
    </div>
  );
} 