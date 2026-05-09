export const DOC_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
};

export const isPending = (status) =>
  status === DOC_STATUS.PENDING || status === 'Pendente';

export const isSigned = (status) =>
  status === DOC_STATUS.SIGNED || status === 'Assinado';
