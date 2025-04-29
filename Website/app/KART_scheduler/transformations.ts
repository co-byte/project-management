/**
 * Algorithm-Specific Methods for Project Management Scheduler
 *
 * This file contains core algorithms and utility functions for scheduling and 
 * dependency management in the project management scheduler. These methods 
 * are highly specific to the current scheduling logic and are prone to change 
 * as the scheduling requirements evolve.
 *
 * Functions:
 * - calculateExpectedDuration: Calculates the expected duration of an activity 
 *   using a Gaussian-based formula.
 * - constructPriorityQueue: Performs a topological sort on a directed graph to determine 
 *   the order of activities based on dependencies.
 * - scheduleActivities: Implements a resource-constrained scheduling algorithm 
 *   with cost tracking and revealingness penalties.
 *
 * Dependencies:
 * - Relies on the `graphlib` library for graph operations.
 * - Uses `Activity` and `ScheduledActivity` interfaces for type definitions.
 *
 * Notes:
 * - The algorithms in this file are subject to change as new requirements 
 *   or optimizations are introduced.
 * - Ensure that the input graph is properly constructed and validated before 
 *   using these functions.
 * - The `calculateExpectedDuration` function assumes that optimistic, likely, 
 *   and pessimistic durations are provided as inputs.
 */

import { Activity } from "../entities/activity";
import { Graph, Edge } from "graphlib";
import { ScheduledActivity } from "../entities/scheduled-activity";

// === Gaussian-based Duration Calculation ===
export function calculateExpectedDuration(
  o: number,
  m: number,
  p: number
): number {
  return (o + 4 * m + p) / 6;
}


// === Topological Sort ===
function constructPriorityQueue(graph: Graph): string[] {
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
  const sorted = constructPriorityQueue(graph);
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
