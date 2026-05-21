export const isAdmin     = role => role === 'admin';
export const isBCBAGroup = role => role === 'bcba' || role === 'bcaba';
export const isRBT       = role => role === 'rbt';
export const canEdit     = (role, client, userId) =>
  isAdmin(role) ||
  (isBCBAGroup(role) && client.bcba_id === userId) ||
  (isRBT(role) && client.rbt_id === userId);
