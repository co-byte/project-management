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

// === Constants ===
const jsonOutputPath = "./Website/data/schedule_kart.json"; // Path to save the JSON output
const totalPeople = 6; // Configure the people available at the start of the project

// === Main Function ===
(async () => {
  console.log(`\n📊 Gantt Schedule (Max ${totalPeople} People):`);

  const rows = await lastValueFrom(ingestCSV("Website/data/input.csv"));
  const dependencies = calculateDependencies(rows);

  const activities: Activity[] = calculateActivities(rows, dependencies);

  const graph = buildGraph(activities);
  const { schedule, totalCost } = scheduleActivities(graph, totalPeople);

  schedule.forEach((activity: ScheduledActivity) => {
    console.log(
      `- ${activity.id.padEnd(10)} | ${activity.activity.padEnd(
        30
      )} | Start: ${activity.activityStartTime.toFixed(
        0
      )} | End: ${activity.activityEndTime.toFixed(0)} | Cost: $${(
        activity.monetary_cost_per_day * activity.expected_duration
      ).toFixed(2)}`
    );
  });

  console.log(`\n💰 Total Accumulated Project Cost: $${totalCost.toFixed(2)}`);

  // Dirty fix
  // Transform the schedule to match the field names as defined in PERT
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

  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));

  console.log("Schedule has been saved to ", jsonOutputPath);
})();
