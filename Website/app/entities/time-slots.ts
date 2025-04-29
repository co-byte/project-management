export type TimeSlots = Record<
  number,
  { peopleAvailable: number; totalRevealingness: number; plannedActivityIds: string[] }
>;
