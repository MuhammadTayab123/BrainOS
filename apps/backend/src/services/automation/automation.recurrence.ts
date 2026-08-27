export type AutomationRecurrence =
  | {
      type: "DAILY";
      hour: number;
      minute: number;
    }
  | {
      type: "WEEKLY";
      dayOfWeek: number;
      hour: number;
      minute: number;
    };

export function calculateNextRunAt(
  recurrence: AutomationRecurrence,
  from: Date,
): Date {
  validateDate(from);

  if (recurrence.type === "DAILY") {
    validateTime(recurrence.hour, recurrence.minute);

    const next = new Date(from);

    next.setHours(recurrence.hour, recurrence.minute, 0, 0);

    if (next.getTime() <= from.getTime()) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  validateDayOfWeek(recurrence.dayOfWeek);

  validateTime(recurrence.hour, recurrence.minute);

  const next = new Date(from);

  next.setHours(recurrence.hour, recurrence.minute, 0, 0);

  let daysUntil = recurrence.dayOfWeek - next.getDay();

  if (daysUntil < 0) {
    daysUntil += 7;
  }

  if (daysUntil === 0 && next.getTime() <= from.getTime()) {
    daysUntil = 7;
  }

  next.setDate(next.getDate() + daysUntil);

  return next;
}

function validateDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Automation recurrence date must be valid.");
  }
}

function validateTime(hour: number, minute: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Automation recurrence hour must be between 0 and 23.");
  }

  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Automation recurrence minute must be between 0 and 59.");
  }
}

function validateDayOfWeek(dayOfWeek: number): void {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Automation recurrence day must be between 0 and 6.");
  }
}
