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
const csvInputPath = "./Website/data/input.csv";
const jsonOutputPath = "./Website/data/schedule_kart.json";

const totalPeople = 6;                  // The amount of people available at the start of the project
const dailyProjectCost = 100;           // Daily project cost (in dollars)
const expectedProjectDuration = 30;     // Expected project duration (in days)
const initialResourceWeight = 2;        // Initial resource weight
const initialRevealingnessWeight = 2;   // Initial revealingness weight
const softMaximumOfRevealingness = 3;   // Soft maximum of revealingness
const hardMaximumOfRevealingsness = 8;  // Hard maximum of revealingness
const revealingnessDecayRate = 0.6;     // Revealingness decay rate


// === Main Function ===
(async () => {
  console.log(`\n📊 Gantt Schedule (Max ${totalPeople} People):`);

  // Prepare the data
  const rows = await lastValueFrom(ingestCSV(csvInputPath));
  const dependencies = calculateDependencies(rows);
  const activities: Activity[] = calculateActivities(rows, dependencies);
  const graph = buildGraph(activities);

  // Schedule the activities
  const { schedule, totalCost } = scheduleActivities(
    graph,
    totalPeople,
    dailyProjectCost,
    expectedProjectDuration,
    initialResourceWeight,
    initialRevealingnessWeight,
    softMaximumOfRevealingness,
    hardMaximumOfRevealingsness,
    revealingnessDecayRate
  );

  // Print the schedule
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
  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));

  console.log("Schedule has been saved to ", jsonOutputPath);
})();
