import { C } from './theme';

export const STATUS_META = {
  PENDING: { label: 'Pending', color: C.yellow },
  APPROVED: { label: 'Approved', color: C.green },
  REJECTED: { label: 'Rejected', color: C.red },
  PENDING_APPROVAL: { label: 'Pending Approval', color: C.yellow },
  ASSIGNED: { label: 'Assigned', color: C.blue },
  IN_PROGRESS: { label: 'In Progress', color: C.orange },
  COMPLETED: { label: 'Completed', color: C.green },
  CANCELLED: { label: 'Cancelled', color: C.textDim },
};

export const PRIORITY_META = {
  LOW: { label: 'Low', color: C.textDim },
  MEDIUM: { label: 'Medium', color: C.blue },
  HIGH: { label: 'High', color: C.orange },
  CRITICAL: { label: 'Critical', color: C.red },
};

export const SPECIALTIES = ['ROAD_REPAIR', 'DRAINAGE', 'ELECTRICAL', 'GENERAL'];
export const WORKER_STATUSES = ['AVAILABLE', 'BUSY', 'INACTIVE'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const WORK_ORDER_STATUSES = [
  'PENDING_APPROVAL',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export const statusMeta = (status) => STATUS_META[status] || { label: status || '—', color: C.textDim };
export const priorityMeta = (priority) => PRIORITY_META[priority] || { label: priority || '—', color: C.textDim };

export const titleCase = (value) =>
  (value || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
