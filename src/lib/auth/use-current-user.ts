import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session.functions";
import type { Permission } from "@/lib/auth/permissions";

export function useCurrentUser() {
  const fn = useServerFn(getCurrentUser);
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}

export function hasPerm(user: CurrentUser | null | undefined, p: Permission) {
  return !!user?.permissions.includes(p);
}
