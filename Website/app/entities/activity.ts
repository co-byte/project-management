export interface Activity {
  id: string;
  activity: string;
  optimistic_duration: number;
  likely_duration: number;
  pessimistic_duration: number;
  expected_duration: number;
  people_required: number;
  monetary_cost_per_day: number;
  chance_of_delays: number;
  weight_of_delays: number;
  chance_of_losing_people: number;
  weight_of_losing_people: number;
  level_of_revealingness: number;
  dependencies: string[];
}
