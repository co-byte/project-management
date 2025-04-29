import { Activity } from "../entities/activity";
import { Graph, Edge } from "graphlib";
import { Row } from "../entities/row";
import { ScheduledActivity } from "../entities/scheduled-activity";

export function calculateDependencies(rows: Row[]): Record<string, string[]> {
  const dependencies: Record<string, string[]> = {};

  // Iterate through each row to extract dependencies
  rows.forEach((row: any) => {
    const deps =
      row.predecessor?.trim() !== "/"
        ? row.predecessor.split(",").map((d: string) => d.trim())
        : [];
    dependencies[row.wbs_code] = deps;
  });

  return dependencies;
}

export function calculateActivities(
  rows: any[],
  dependencies: Record<string, string[]>
): Activity[] {
  return rows.map((row: any) => ({
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
    level_of_revealingness: parseFloat(row.level_of_revealingness),
    chance_of_delays: parseFloat(row.chance_of_delays),
    weight_of_delays: parseFloat(row.weight_of_delays),
    chance_of_losing_people: parseFloat(row.chance_of_losing_people),
    weight_of_losing_people: parseFloat(row.weight_of_losing_people),
    dependencies: dependencies[row.wbs_code] || [],
  }));
}

// === Gaussian-based Duration Calculation ===
export function calculateExpectedDuration(
  o: number,
  m: number,
  p: number
): number {
  return (o + 4 * m + p) / 6;
}

// === Graph Construction ===
export function buildGraph(activities: Activity[]): Graph {
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
export function topologicalSort(graph: Graph): string[] {
  const inDegree: Record<string, number> = {};
  const queue: string[] = [];
  const sorted: string[] = [];

  graph.nodes().forEach((node: string | number) => (inDegree[node] = 0));
  graph.edges().forEach((edge: { w: string | number }) => {
    inDegree[edge.w] += 1;
  });

  graph.nodes().forEach((node: string) => {
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
export function scheduleActivities(
  graph: Graph,
  totalPeople: number,
  reveilingsness_threshold: number = 0
): { schedule: ScheduledActivity[]; totalCost: number } {
  const sorted = topologicalSort(graph);
  const schedule: ScheduledActivity[] = [];

  const timeSlots: {
    peopleUsed: number;
    cost: number;
    reveilingnessSum: number;
  }[] = [];
  const activityMap: Record<string, ScheduledActivity> = {};

  for (const nodeId of sorted) {
    const activity = graph.node(nodeId) as Activity;

    const earliestStart = Math.max(
      0,
      ...(graph.inEdges(nodeId) || []).map((e: { v: string | number }) => {
        const pred = activityMap[e.v];
        return pred.end;
      })
    );

    // Schedule the activity at the earliest possible time
    let bestStart = earliestStart;
    let minRevealingPenalty = 0; // Start with a penalty higher than the threshold

    // Try all start times from earliest possible to some reasonable future limit
    let latestStartThreshold = earliestStart + 100; // Arbitrary limit for search
    for (
      let potentialStart = earliestStart;
      potentialStart < latestStartThreshold;
      potentialStart++
    ) {
      let canSchedule = true;
      let revealingPenalty = 0;

      for (
        let t = potentialStart;
        t < potentialStart + activity.expected_duration;
        t++
      ) {
        // Check if the time slot is available and within people capacity
        const timeSlot = timeSlots[t] || {
          peopleUsed: 0,
          cost: 0,
          revealingnessSum: 0,
        };
        if (timeSlot.peopleUsed + activity.people_required > totalPeople) {
          canSchedule = false;
          break;
        }

        // Add penalty if high cumulative revealingness
        const projectedRevealingness =
          timeSlot.reveilingnessSum + activity.level_of_revealingness;
        if (projectedRevealingness > reveilingsness_threshold) {
          revealingPenalty += projectedRevealingness - reveilingsness_threshold;
        }
      }

      if (canSchedule && revealingPenalty < minRevealingPenalty) {
        minRevealingPenalty = revealingPenalty;
        bestStart = potentialStart;
        if (revealingPenalty === 0) break; // best case
      }
    }

    const start = bestStart;
    const end = start + activity.expected_duration;
    // Allocate people, cost, and revealingness in time slots
    for (let t = start; t < end; t++) {
      if (!timeSlots[t]) {
        timeSlots[t] = { peopleUsed: 0, cost: 0, reveilingnessSum: 0 };
      }
      timeSlots[t].peopleUsed += activity.people_required;
      timeSlots[t].cost += activity.monetary_cost_per_day;
      timeSlots[t].reveilingnessSum += activity.level_of_revealingness;
    }

    const scheduled: ScheduledActivity = { ...activity, start, end };
    schedule.push(scheduled);
    activityMap[nodeId] = scheduled;
  }

  const totalCost = timeSlots.reduce((sum, t) => sum + t.cost, 0);

  return { schedule, totalCost };
}
