import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/discord/constants";
import {
  canAccess,
  listPermissions,
  type Permission,
  type SessionUser,
} from "./permissions";

const ALL_PERMISSIONS: Permission[] = [
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

const userWith = (...roleIds: string[]): SessionUser => ({
  discordId: "test-id",
  username: "tester",
  roleIds,
});

const sorted = (arr: Permission[]) => [...arr].sort();

describe("permissions matrix", () => {
  const HIGH_STAFF_ALL = ALL_PERMISSIONS;

  it("STAFF_FACTION → toutes les permissions", () => {
    const u = userWith(ROLES.STAFF_FACTION);
    expect(sorted(listPermissions(u))).toEqual(sorted(HIGH_STAFF_ALL));
  });

  it("HIGH_STAFF_PUBLIC → toutes les permissions", () => {
    const u = userWith(ROLES.HIGH_STAFF_PUBLIC);
    expect(sorted(listPermissions(u))).toEqual(sorted(HIGH_STAFF_ALL));
  });

  it("STAFF_POINTS → profile.self, members.view, points/donations/config.manage", () => {
    const u = userWith(ROLES.STAFF_POINTS);
    expect(sorted(listPermissions(u))).toEqual(
      sorted([
        "profile.self",
        "members.view",
        "points.manage",
        "donations.manage",
        "config.manage",
      ]),
    );
  });

  it("RECRUITER_PUBLIC → profile.self + recruit.access", () => {
    const u = userWith(ROLES.RECRUITER_PUBLIC);
    expect(sorted(listPermissions(u))).toEqual(
      sorted(["profile.self", "recruit.access"]),
    );
  });

  it("MEMBER_FACTION → seulement profile.self", () => {
    const u = userWith(ROLES.MEMBER_FACTION);
    expect(sorted(listPermissions(u))).toEqual(["profile.self"]);
  });

  it("STAFF_TICKET → seulement profile.self", () => {
    const u = userWith(ROLES.STAFF_TICKET);
    expect(sorted(listPermissions(u))).toEqual(["profile.self"]);
  });
});

describe("edge cases", () => {
  it("user=null → canAccess renvoie false pour toutes les permissions", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(canAccess(null, p)).toBe(false);
    }
  });

  it("user=null → listPermissions renvoie []", () => {
    expect(listPermissions(null)).toEqual([]);
  });

  it("rôle inconnu → aucune permission", () => {
    const u = userWith("999");
    expect(listPermissions(u)).toEqual([]);
    for (const p of ALL_PERMISSIONS) {
      expect(canAccess(u, p)).toBe(false);
    }
  });
});

describe("héritages explicites", () => {
  it("isHighStaff (STAFF_FACTION) → admin.access true", () => {
    expect(canAccess(userWith(ROLES.STAFF_FACTION), "admin.access")).toBe(true);
  });

  it("isHighStaff (HIGH_STAFF_PUBLIC) → admin.access true", () => {
    expect(canAccess(userWith(ROLES.HIGH_STAFF_PUBLIC), "admin.access")).toBe(
      true,
    );
  });

  it("STAFF_POINTS → points.manage true, members.edit false", () => {
    const u = userWith(ROLES.STAFF_POINTS);
    expect(canAccess(u, "points.manage")).toBe(true);
    expect(canAccess(u, "members.edit")).toBe(false);
  });

  it("MEMBER_FACTION seul → uniquement profile.self", () => {
    const u = userWith(ROLES.MEMBER_FACTION);
    expect(canAccess(u, "profile.self")).toBe(true);
    for (const p of ALL_PERMISSIONS.filter((x) => x !== "profile.self")) {
      expect(canAccess(u, p)).toBe(false);
    }
  });
});

describe("exhaustivité", () => {
  const samples: Array<SessionUser | null> = [
    null,
    userWith(),
    userWith("999"),
    userWith(ROLES.STAFF_FACTION),
    userWith(ROLES.HIGH_STAFF_PUBLIC),
    userWith(ROLES.STAFF_POINTS),
    userWith(ROLES.RECRUITER_PUBLIC),
    userWith(ROLES.MEMBER_FACTION),
    userWith(ROLES.STAFF_TICKET),
  ];

  it("canAccess renvoie toujours un booléen (jamais undefined)", () => {
    for (const u of samples) {
      for (const p of ALL_PERMISSIONS) {
        const result = canAccess(u, p);
        expect(typeof result).toBe("boolean");
      }
    }
  });
});
