import type { MemberRecord } from "@/lib/types";
import { getInitials } from "@/lib/utils";

export function CollaboratorChip({ member }: { member: MemberRecord }) {
  const label =
    member.profile?.first_name ??
    member.profile?.full_name ??
    member.profile?.id ??
    member.user_id;

  return (
    <div
      title={label}
      className="flex h-9 min-w-9 items-center justify-center rounded-full border border-olive/16 bg-paper px-3 text-xs font-medium text-ink shadow-[0_10px_18px_rgba(77,92,58,0.1)]"
    >
      {member.profile?.first_name ?? getInitials(label)}
    </div>
  );
}

