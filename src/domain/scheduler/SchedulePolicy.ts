export interface SchedulePolicy {
  scheduledFor: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export function validateSchedulePolicy(policy: SchedulePolicy): SchedulePolicy {
  const scheduledFor = policy.scheduledFor.trim();

  if (scheduledFor.length === 0) {
    throw new Error('Schedule policy requires scheduledFor.');
  }

  if (Number.isNaN(Date.parse(scheduledFor))) {
    throw new Error(`Schedule policy scheduledFor must be a valid date: ${policy.scheduledFor}.`);
  }

  return {
    ...policy,
    scheduledFor
  };
}
