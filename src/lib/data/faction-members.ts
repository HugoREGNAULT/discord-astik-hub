export interface FactionMemberLike {
  ig_name?: string | null;
  current_grade?: string | null;
  arrival_date?: string | null;
  mc_uuid?: string | null;
}

export function isFactionMember(member: FactionMemberLike) {
  return Boolean(member.ig_name || member.current_grade || member.arrival_date || member.mc_uuid);
}

export function filterFactionMembers<T extends FactionMemberLike>(
  members: T[] | null | undefined,
): T[] {
  return (members ?? []).filter(isFactionMember);
}