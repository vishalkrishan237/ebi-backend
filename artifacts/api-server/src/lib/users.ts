import type { UserRow } from "@workspace/db";

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    freeFireUid: u.freeFireUid,
    coinBalance: u.coinBalance,
    isAdmin: u.isAdmin,
  };
}
