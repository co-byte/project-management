import { Activity } from "./activity";

export interface ScheduledActivity extends Activity {
  activityStartTime: number;
  activityEndTime: number;
}
