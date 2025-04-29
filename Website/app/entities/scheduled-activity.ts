import { Activity } from "./activity";

export interface ScheduledActivity extends Activity {
  start: number;
  end: number;
}
