import {
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fromKobo } from '../utils/formatters';

export interface AdminUserRecord {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
}

export interface AdminProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  stage: string;
  status: string;
  location: string;
  budgetCapKobo: number;
  budgetCap: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditRecord {
  id: string;
  projectId: string;
  ownerId: string;
  timestamp: string;
  user: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
}

export interface AdminOverview {
  users: AdminUserRecord[];
  projects: AdminProjectRecord[];
  auditEvents: AdminAuditRecord[];
}

const ADMIN_QUERY_LIMIT = 200;

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const [usersSnapshot, projectsSnapshot, auditSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'userProfiles'), limit(ADMIN_QUERY_LIMIT))),
    getDocs(query(collection(db, 'projects'), limit(ADMIN_QUERY_LIMIT))),
    getDocs(query(collection(db, 'auditEvents'), limit(ADMIN_QUERY_LIMIT))),
  ]);

  const users = usersSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        email: typeof data.email === 'string' ? data.email : null,
        displayName: typeof data.displayName === 'string' ? data.displayName : null,
        role: safeString(data.role) || 'user',
      };
    })
    .sort((a, b) => (a.displayName || a.email || a.id).localeCompare(b.displayName || b.email || b.id));

  const projects = projectsSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      const budgetCapKobo = Math.round(safeNumber(data.budgetCapKobo));
      return {
        id: snapshot.id,
        ownerId: safeString(data.ownerId),
        name: safeString(data.name) || 'Untitled Project',
        code: safeString(data.code),
        stage: safeString(data.stage),
        status: safeString(data.status) || 'Inactive',
        location: safeString(data.location),
        budgetCapKobo,
        budgetCap: fromKobo(budgetCapKobo),
        createdAt: safeString(data.createdAt),
        updatedAt: safeString(data.updatedAt),
      };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return bTime - aTime;
    });

  const auditEvents = auditSnapshot.docs
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        projectId: safeString(data.projectId),
        ownerId: safeString(data.ownerId),
        timestamp: safeString(data.timestamp),
        user: safeString(data.user),
        userEmail: safeString(data.userEmail),
        action: safeString(data.action),
        entity: safeString(data.entity),
        entityId: safeString(data.entityId),
        summary: safeString(data.summary),
      };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.timestamp) || 0;
      const bTime = Date.parse(b.timestamp) || 0;
      return bTime - aTime;
    });

  return {
    users,
    projects,
    auditEvents,
  };
}
