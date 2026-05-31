import type { getMemberDetail } from "@/lib/data/members.functions";

export type MemberDetailData = Awaited<ReturnType<typeof getMemberDetail>>;
export type MemberRow = NonNullable<MemberDetailData["member"]>;
export type MemberAlt = MemberDetailData["alts"][number];
export type MemberNote = MemberDetailData["notes"][number];
export type MemberWarning = MemberDetailData["warnings"][number];
export type MemberPointsEntry = MemberDetailData["pointsLedger"][number];
export type MemberDonationEntry = MemberDetailData["donations"][number];
