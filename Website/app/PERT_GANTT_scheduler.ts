import { ingestCSV } from "./csv_ingestion";
import { Graph, Edge } from "graphlib";
import { lastValueFrom } from "rxjs";
import * as fs from "fs"; // Node.js file system for saving the JSON output

const jsonOutputPath = "C:/Users/cobev/OneDrive - UGent/2024_2025_Informatica/sem2/project_management/planning-application/project-management/Website/data/v2/schedules/rcp_6_people.json"
const totalPeople = 6; // CHANGE this to simulate constraints

interface Activity {
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

interface ScheduledActivity extends Activity {
  start: number;
  end: number;
}

// === PERT Duration Calculation ===
function calculateExpectedDuration(o: number, m: number, p: number): number {
  return (o + 4 * m + p) / 6;
}

// === Graph Construction ===
function buildGraph(activities: Activity[]): Graph {
  const g = new Graph();

  activities.forEach((act) => {
    g.setNode(act.id, act);
    act.dependencies.forEach((dep: string) => {
      if (dep && dep.trim() && dep !== "/") {
        g.setEdge(dep.trim(), act.id);
      }
    });
  });

  return g;
}

// === Topological Sort ===
function topologicalSort(graph: Graph): string[] {
  const inDegree: Record<string, number> = {};
  const queue: string[] = [];
  const sorted: string[] = [];

  graph.nodes().forEach((node) => (inDegree[node] = 0));
  graph.edges().forEach((edge) => {
    inDegree[edge.w] += 1;
  });

  graph.nodes().forEach((node) => {
    if (inDegree[node] === 0) {
      queue.push(node);
    }
  });

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    graph.outEdges(node)?.forEach((edge: Edge) => {
      inDegree[edge.w] -= 1;
      if (inDegree[edge.w] === 0) {
        queue.push(edge.w);
      }
    });
  }

  if (sorted.length !== graph.nodeCount()) {
    throw new Error("Cycle detected in activity dependencies.");
  }

  return sorted;
}

// === Resource-Constrained Scheduling with Cost Tracking ===
function scheduleActivities(
  graph: Graph,
  totalPeople: number,
  projectCostPerDay: number
): { schedule: ScheduledActivity[]; totalCost: number } {
  const sorted = topologicalSort(graph);
  console.log("Topological Sort Order:", sorted);
  const schedule: ScheduledActivity[] = [];

  const timeSlots: { peopleUsed: number; cost: number }[] = [];
  const activityMap: Record<string, ScheduledActivity> = {};

  for (const nodeId of sorted) {
    const act = graph.node(nodeId) as Activity;

    const earliestStart = Math.max(
      0,
      ...(graph.inEdges(nodeId) || []).map((e) => {
        const pred = activityMap[e.v];
        return pred.end;
      })
    );

    let start = earliestStart;

    // Find time slot with enough people
    while (true) {
      let canSchedule = true;
      for (let t = start; t < start + act.expected_duration; t++) {
        const slot = timeSlots[t] || { peopleUsed: 0, cost: 0 };
        if (slot.peopleUsed + act.people_required > totalPeople) {
          canSchedule = false;
          break;
        }
      }

      if (canSchedule) break;
      start += 1; // delay start
    }

    const end = start + act.expected_duration;

    // Allocate people and cost in time slots
    for (let t = start; t < end; t++) {
      if (!timeSlots[t]) timeSlots[t] = { peopleUsed: 0, cost: 0 };
      timeSlots[t].peopleUsed += act.people_required;
      timeSlots[t].cost += act.monetary_cost_per_day;
    }

    const scheduled: ScheduledActivity = { ...act, start, end };
    schedule.push(scheduled);
    activityMap[nodeId] = scheduled;
  }

  // let totalCost = timeSlots.reduce((sum, t) => sum + t.cost, 0);
  let totalCost = 0;
  for (const timeslot in timeSlots) {
    totalCost += projectCostPerDay;
    totalCost += timeSlots[timeslot].cost;
  }

  return { schedule, totalCost };
}

// === MAIN ===
(async () => {
  const rows = await lastValueFrom(ingestCSV("Website/data/input.csv"));

  const dependencies: Record<string, string[]> = {};
  rows.forEach((row: any) => {
    const deps =
      row.predecessor?.trim() !== "/"
        ? row.predecessor.split(",").map((d: string) => d.trim())
        : [];
    dependencies[row.wbs_code] = deps;
  });

  const activities: Activity[] = rows.map((row: any) => ({
    id: row.wbs_code,
    activity: row.activity,
    optimistic_duration: parseFloat(row.optimistic_duration),
    likely_duration: parseFloat(row.likely_duration),
    pessimistic_duration: parseFloat(row.pessimistic_duration),
    expected_duration: calculateExpectedDuration(
      parseFloat(row.optimistic_duration),
      parseFloat(row.likely_duration),
      parseFloat(row.pessimistic_duration)
    ),
    people_required: parseInt(row.people_required),
    monetary_cost_per_day: parseFloat(row.monetary_cost_per_day),
    chance_of_delays: parseFloat(row.chance_of_delays),
    weight_of_delays: parseFloat(row.weight_of_delays),
    chance_of_losing_people: parseFloat(row.chance_of_losing_people),
    weight_of_losing_people: parseFloat(row.weight_of_losing_people),
    level_of_revealingness: parseFloat(row.level_of_revealingness),
    dependencies: dependencies[row.wbs_code] || [],
  }));

  const graph = buildGraph(activities);

  const { schedule, totalCost } = scheduleActivities(graph, totalPeople, 100);

  console.log(`\n📊 Gantt Schedule (Max ${totalPeople} People):`);
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

  console.log(`\nTotal Accumulated Project Cost: $${totalCost.toFixed(2)}`);

  // Save the total cost and schedule to a JSON file
  let output = {
    totalCost: totalCost,
    schedule: schedule,
  };
  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));

  console.log("Schedule has been saved to", jsonOutputPath);
})();
