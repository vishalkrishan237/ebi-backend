import type { UserRow } from "../../models/index.js";

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    freeFireUid: u.freeFireUid,
    coinBalance: u.coinBalance,
    isAdmin: u.isAdmin,
    isBanned: u.isBanned,
  };
}
