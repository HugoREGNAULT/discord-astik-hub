/**
 * Table centrale des permissions.
 *
 * Règle d'or : toute fonction serveur sensible passe par requirePermission(...)
 * AVANT toute lecture/écriture. Le front ne peut pas être source de vérité.
 *
 * Une permission = condition booléenne sur la liste des rôles Discord d'un
 * utilisateur (rôles agrégés sur les deux serveurs : public + faction).
 */

import { ROLES } from "@/lib/discord/constants";

export type Permission =
  | "profile.self"
  | "members.view"
  | "members.edit"
  | "notes.view"
  | "notes.write"
  | "warnings.view"
  | "warnings.write"
  | "points.manage"
  | "donations.manage"
  | "config.manage"
  | "recruit.access"
  | "objectives.edit"
  | "admin.access";

export interface SessionUser {
  discordId: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  /** Rôles agrégés des deux serveurs surveillés. */
  roleIds: string[];
}

const hasAny = (user: SessionUser, ...roleIds: string[]) =>
  roleIds.some((r) => user.roleIds.includes(r));

/** Haut staff = staff faction privé OU haut staff public. */
export const isHighStaff = (user: SessionUser) =>
  hasAny(user, ROLES.STAFF_FACTION, ROLES.HIGH_STAFF_PUBLIC);

export const isStaffPoints = (user: SessionUser) =>
  hasAny(user, ROLES.STAFF_POINTS) || isHighStaff(user);

export const isStaffFaction = (user: SessionUser) =>
  hasAny(user, ROLES.STAFF_FACTION) || isHighStaff(user);

export const isRecruiter = (user: SessionUser) =>
  hasAny(user, ROLES.RECRUITER_PUBLIC) || isHighStaff(user);

export const isFactionMember = (user: SessionUser) =>
  hasAny(user, ROLES.MEMBER_FACTION) ||
  isStaffFaction(user) ||
  isStaffPoints(user) ||
  hasAny(user, ROLES.STAFF_TICKET);

export function canAccess(user: SessionUser | null, perm: Permission): boolean {
  if (!user) return false;
  switch (perm) {
    case "profile.self":
      return isFactionMember(user) || isRecruiter(user) || isHighStaff(user);
    case "members.view":
      return isStaffFaction(user) || isStaffPoints(user);
    case "members.edit":
      return isStaffFaction(user);
    case "notes.view":
    case "warnings.view":
      return isStaffFaction(user);
    case "notes.write":
    case "warnings.write":
      return isStaffFaction(user);
    case "points.manage":
      return isStaffPoints(user);
    case "donations.manage":
      return isStaffPoints(user);
    case "config.manage":
      return isStaffPoints(user);
    case "recruit.access":
      return isRecruiter(user);
    case "objectives.edit":
      return isStaffFaction(user);
    case "admin.access":
      return isHighStaff(user);
  }
}

/** Renvoie la liste des permissions accordées (utile pour l'UI). */
export function listPermissions(user: SessionUser | null): Permission[] {
  if (!user) return [];
  const all: Permission[] = [
    "profile.self",
    "members.view",
    "members.edit",
    "notes.view",
    "notes.write",
    "warnings.view",
    "warnings.write",
    "points.manage",
    "donations.manage",
    "config.manage",
    "recruit.access",
    "objectives.edit",
    "admin.access",
  ];
  return all.filter((p) => canAccess(user, p));
}
