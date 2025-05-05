import * as fs from "fs"; // Node.js file system for saving the JSON output
import { lastValueFrom } from "rxjs";

import { ingestCSV } from "../ingestion/csv_ingestion";
import { scheduleActivities } from "../KART_scheduler/transformations";
import {
  buildGraph,
  calculateActivities,
  calculateDependencies,
} from "../KART_scheduler/utility";
import { Activity } from "../entities/activity";
import { ScheduledActivity } from "../entities/scheduled-activity";

// === Main Function ===
export async function runScheduleWithParameters(config: {
  csvInputPath: string;
  jsonOutputPath: string;
  totalPeople: number;
  dailyProjectCost: number;
  expectedProjectDuration: number;
  initialResourceWeight: number;
  initialRevealingnessWeight: number;
  softMaximumOfRevealingness: number;
  hardMaximumOfRevealingsness: number;
  revealingnessDecayRate: number;
  startTimeSlot: number;
  startRevealingness: number;
}) {
  // console.log(`\n📊 Gantt Schedule (Max ${config.totalPeople} People):`);

  // Prepare the data
  const rows = await lastValueFrom(ingestCSV(config.csvInputPath));
  const dependencies = calculateDependencies(rows);
  const activities: Activity[] = calculateActivities(rows, dependencies);
  const graph = buildGraph(activities);

  // Schedule the activities
  const { schedule, totalCost } = scheduleActivities(
    graph,
    config.totalPeople,
    config.dailyProjectCost,
    config.expectedProjectDuration,
    config.initialResourceWeight,
    config.initialRevealingnessWeight,
    config.softMaximumOfRevealingness,
    config.hardMaximumOfRevealingsness,
    config.revealingnessDecayRate,
    config.startTimeSlot,
    config.startRevealingness,
  );

  // Print the schedule
  // schedule.forEach((activity: ScheduledActivity) => {
  //   console.log(
  //     `- ${activity.id.padEnd(10)} | ${activity.activity.padEnd(
  //       30
  //     )} | Start: ${activity.activityStartTime.toFixed(
  //       0
  //     )} | End: ${activity.activityEndTime.toFixed(0)} | Cost: $${(
  //       activity.monetary_cost_per_day * activity.expected_duration
  //     ).toFixed(2)}`
  //   );
  // });
  // console.log(`\n💰 Total Accumulated Project Cost: $${totalCost.toFixed(2)}`);

  // Dirty fix to transform the schedule names to match the field names as defined in PERT
  const transformedSchedule = schedule.map((activity) => ({
    ...activity,
    start: activity.activityStartTime,
    end: activity.activityEndTime,
    activityStartTime: undefined, // Remove the old field
    activityEndTime: undefined, // Remove the old field
  }));

  // Save the total cost and schedule to a JSON file
  let output = {
    totalCost: totalCost,
    schedule: transformedSchedule,
  };
  fs.writeFileSync(config.jsonOutputPath, JSON.stringify(output, null, 2));

  console.log("Schedule has been saved to ", config.jsonOutputPath);
};
