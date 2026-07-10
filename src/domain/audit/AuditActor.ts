export type AuditActorType = 'system' | 'workflow' | 'service' | 'user';

export interface AuditActor {
  type: AuditActorType;
  id: string;
  name?: string;
}
