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

// === Constants ===
const jsonOutputPath = "./Website/data/schedule_kart.json"; // Path to save the JSON output
const totalPeople = 4; // Configure the people available at the start of the project

// === Main Function ===
(async () => {
  console.log(`\n📊 Gantt Schedule (Max ${totalPeople} People):`);

  const rows = await lastValueFrom(ingestCSV("Website/data/input.csv"));
  const dependencies = calculateDependencies(rows);

  const activities: Activity[] = calculateActivities(rows, dependencies);

  const graph = buildGraph(activities);
  const { schedule, totalCost } = scheduleActivities(graph, totalPeople);

  schedule.forEach((act) => {
    console.log(
      `- ${act.id.padEnd(10)} | ${act.activity.padEnd(
        30
      )} | Start: ${act.start.toFixed(0)} | End: ${act.end.toFixed(
        0
      )} | Cost: $${(act.monetary_cost_per_day * act.expected_duration).toFixed(
        2
      )}`
    );
  });

  console.log(`\n💰 Total Accumulated Project Cost: $${totalCost.toFixed(2)}`);

  // Save the total cost and schedule to a JSON file
  let output = {
    totalCost: totalCost,
    schedule: schedule,
  };

  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));

  console.log("Schedule has been saved to ", jsonOutputPath);
})();
