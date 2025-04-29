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
import { MinPriorityQueue } from "@datastructures-js/priority-queue";
import { Queue } from "@datastructures-js/queue";

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

function calculateWeightedActivityPriority(
  activity: Activity,
  weight_of_revealingness: number,
  weight_of_resources: number
): number {
  // Calculate the weighted priority of an activity based on its attributes
  // (Lowest score gets processed first)
  //    -> High revealingsness => higher score (schedule later)
  //    -> High resource requirement => lower score (schedule as soon as possible)

  let score =
    activity.level_of_revealingness * weight_of_revealingness -
    activity.people_required * weight_of_resources;

  return score; // < 0 ? 0 : score; // Ensure non-negative score
}

// === Topological Sort ===
function constructPriorityQueue(
  graph: Graph,
  weight_of_revealingness: number,
  weight_of_resources: number
): Queue<Activity> {
  
  // +++ Step 1: Define sorting rules for priority queue +++
  // Debugging output
  (activity: Activity) => {
    const weighted_priority = calculateWeightedActivityPriority(
      activity,
      weight_of_revealingness,
      weight_of_resources
    );
    console.debug(
      "\nconstructPriorityQueue - Activity (",
      activity.activity.trim(),
      ") | Score: ",
      weighted_priority
    );
  };
  // Create a priority queue for activities which sorts by level_of_revealingness (ascending)
  const weightedActivityQueue = new MinPriorityQueue<Activity>(
    (activity: Activity): number =>
      calculateWeightedActivityPriority(
        activity,
        weight_of_revealingness,
        weight_of_resources
      )
  );

  // +++ Step 2: Fill the priority queue with activities +++
  const inDegree: Record<string, number> = {};

  // Initialize in-degree and add nodes with in-degree 0 to the priority queue
  graph.nodes().forEach((node: string | number) => {
    inDegree[node] = 0; // Initialize in-degree to 0
  });
  graph.edges().forEach((edge: { w: string | number }) => {
    inDegree[edge.w] = (inDegree[edge.w] || 0) + 1; // Increment in-degree
  });

  graph.nodes().forEach((node: string) => {
    if (inDegree[node] === 0) {
      const activity = graph.node(node) as Activity;
      weightedActivityQueue.enqueue(activity);
    }
  });

  // +++ Step 3: Use the weightedActivityQueue to construct the sortedActivitiesQueue +++
  const sortedActivitiesQueue = new Queue<Activity>();

  // Process the priority queue
  while (!weightedActivityQueue.isEmpty()) {
    const activity = weightedActivityQueue.dequeue();

    if (!activity) {
      throw new Error("Failed to dequeue activity from priority queue.");
    }

    sortedActivitiesQueue.push(activity);

    // Process outgoing edges and update in-degree
    graph.outEdges(activity.id)?.forEach((edge: Edge) => {
      inDegree[edge.w] -= 1;
      if (inDegree[edge.w] === 0) {
        const dependentActivity = graph.node(edge.w) as Activity;
        weightedActivityQueue.enqueue(dependentActivity);
      }
    });
  }

  // +++ Step 4: Check for cycles +++
  // Check for cycles
  if (sortedActivitiesQueue.size() !== graph.nodeCount()) {
    throw new Error("Cycle detected in activity dependencies.");
  }

  // +++ Step 5: Provide debugging information and return the sortedActivitiesQueue +++
  // Debugging output
  console.debug("\nconstructPriorityQueue - Sorted graph nodes:");
  sortedActivitiesQueue.toArray().forEach((activity: Activity) => {
    console.debug(
      ` - Activity: '${activity.activity.trim()}', Revealingness: ${
        activity.level_of_revealingness
      }`
    );
  });

  return sortedActivitiesQueue;
}

// === Resource-Constrained Scheduling with Cost Tracking ===
export function scheduleActivities(
  graph: Graph,
  peopleAvailableAtStart: number,
  softMaximumOfRevealingness: number = 0,
  hardMaximumOfRevealingsness: number = 0
): { schedule: ScheduledActivity[]; totalCost: number } {
  const activityQueue = constructPriorityQueue(graph, 2, 1); // Topologically sorted nodes
  const schedule: ScheduledActivity[] = [];

  let timestamp = 0; // Initialize timestamp for scheduling

  // while (activityQueue.length > 0) {
  return { schedule, totalCost: 0 }; // Placeholder for total cost calculation
}

// Helper function to find the best start time for an activity
function findBestStartTime(
  activity: Activity,
  earliestStart: number,
  timeSlots: Record<
    number,
    { peopleUsed: number; cost: number; revealingnessSum: number }
  >,
  totalPeople: number,
  revealingnessThreshold: number
): { bestStart: number; bestPenalty: number } {
  let bestStart = earliestStart;
  let bestPenalty = Infinity;

  for (
    let potentialStart = earliestStart;
    potentialStart < earliestStart + 100;
    potentialStart++
  ) {
    let canSchedule = true;
    let revealingPenalty = 0;

    for (
      let t = potentialStart;
      t < potentialStart + activity.expected_duration;
      t++
    ) {
      const timeSlot = timeSlots[t] || {
        peopleUsed: 0,
        cost: 0,
        revealingnessSum: 0,
      };

      // Check resource constraint
      if (timeSlot.peopleUsed + activity.people_required > totalPeople) {
        canSchedule = false;
        break;
      }

      // Calculate revealingness penalty
      const projectedRevealingness =
        timeSlot.revealingnessSum + activity.level_of_revealingness;
      if (projectedRevealingness > revealingnessThreshold) {
        revealingPenalty += projectedRevealingness - revealingnessThreshold;
      }
    }

    if (canSchedule && revealingPenalty < bestPenalty) {
      bestPenalty = revealingPenalty;
      bestStart = potentialStart;

      // Stop early if no penalty
      if (revealingPenalty === 0) break;
    }
  }

  return { bestStart, bestPenalty };
}
