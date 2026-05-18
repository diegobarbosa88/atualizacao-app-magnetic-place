export const DOC_STATUS = {
  PENDING: 'pending',
  AWAITING_ADMIN: 'awaiting_admin',
  SIGNED: 'signed',
};

export const isPending = (status) =>
  status === DOC_STATUS.PENDING || status === 'Pendente';

export const isAwaitingAdmin = (status) =>
  status === DOC_STATUS.AWAITING_ADMIN;

// Considered "signed" only when both worker AND admin have signed.
export const isSigned = (status) =>
  status === DOC_STATUS.SIGNED || status === 'Assinado';
