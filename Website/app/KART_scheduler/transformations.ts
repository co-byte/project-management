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
import { TimeSlots } from "../entities/time-slots";

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
  weightOfRevealingness: number,
  weightOfResources: number
): number {
  // Calculate the weighted priority of an activity based on its attributes
  // (Lowest score gets processed first)
  //    -> High revealingsness => higher score (schedule later)
  //    -> High resource requirement => lower score (schedule as soon as possible)

  let score =
    activity.level_of_revealingness * weightOfRevealingness -
    activity.people_required * weightOfResources;

  return score; // < 0 ? 0 : score; // Ensure non-negative score
}

// === Activity Queue Construction ===
function constructPriorityQueue(
  graph: Graph,
  weightOfRevealingness: number,
  weightOfResources: number
): Queue<Activity> {
  // +++ Step 1: Define sorting rules for priority queue +++
  // Debugging output
  // (activity: Activity) => {
  //   const weightedPriority = calculateWeightedActivityPriority(
  //     activity,
  //     weightOfRevealingness,
  //     weightOfResources
  //   );
  //   console.debug(
  //     "\nconstructPriorityQueue - Activity (",
  //     activity.activity.trim(),
  //     ") | Score: ",
  //     weightedPriority
  //   );
  // };

  // Create a priority queue for activities which sorts by level_of_revealingness (ascending)
  const weightedActivityQueue = new MinPriorityQueue<Activity>(
    (activity: Activity): number =>
      calculateWeightedActivityPriority(
        activity,
        weightOfRevealingness,
        weightOfResources
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
  // console.debug("\nconstructPriorityQueue - Sorted graph nodes:");
  // sortedActivitiesQueue.toArray().forEach((activity: Activity) => {
  //   console.debug(
  //     ` - Activity: '${activity.activity.trim()}', Revealingness: ${
  //       activity.level_of_revealingness
  //     }`
  //   );
  // });

  return sortedActivitiesQueue;
}

// === Resource-Constrained Scheduling with Cost Tracking ===
export function scheduleActivities(
  graph: Graph,
  peopleAvailableAtStart: number,
  dailyProjectCost: number = 100,
  expectedProjectDuration: number = 30,
  initialResourceWeight: number = 2,
  initialRevealingnessWeight: number = 2,
  softMaximumOfRevealingness: number = 3,
  hardMaximumOfRevealingsness: number = 6,
  revealingnessDecayRate: number = 0.95,
  startTimeSlot: number = 0,
  startRevealingness: number = 0,
): { schedule: ScheduledActivity[]; totalCost: number } {
  const schedule: ScheduledActivity[] = [];

  // Dict to track state of time slots
  const timeSlots: TimeSlots = {};

  let weightOfResources = initialResourceWeight;
  let weightOfRevealingness = initialRevealingnessWeight;
  let peopleAvailable = peopleAvailableAtStart;
  let currentTimeSlot = startTimeSlot;

  // Initialize the first time slot with available people and revealingness
  timeSlots[startTimeSlot] = {
    peopleAvailable: peopleAvailable,
    totalRevealingness: startRevealingness,
    plannedActivityIds: [],
  };

  while (true) {
    const orderedActivities = constructPriorityQueue(
      graph,
      weightOfRevealingness,
      weightOfResources
    ).toArray();

    if (orderedActivities.length === 0) {
      console.debug("ScheduleActivities - Scheduling completed.");
      break; // Exit loop
    }

    // If no activities have already been scheduled in the current time slot,
    // initialize the time slot with the default available people and the decayed revealingness of the previous time slot
    if (!timeSlots[currentTimeSlot]) {
      timeSlots[currentTimeSlot] = {
        peopleAvailable: peopleAvailable,
        totalRevealingness: 0, // Initialize to 0 as a placeholder
        plannedActivityIds: [],
      };
    }

    // Update the time slot with the decayed revealingness of the previous time slot
    timeSlots[currentTimeSlot].totalRevealingness =
      timeSlots[currentTimeSlot].totalRevealingness +
        timeSlots[currentTimeSlot - 1]?.totalRevealingness *
          revealingnessDecayRate || 0;

    orderedActivities.forEach((activity: Activity) => {
      const activityStartTime = currentTimeSlot;
      const activityEndTime = Math.ceil(
        currentTimeSlot + activity.expected_duration
      );

      if (
        activityCanBeScheduled(
          activity,
          currentTimeSlot,
          timeSlots,
          orderedActivities,
          activityStartTime,
          activityEndTime,
          schedule,
          hardMaximumOfRevealingsness
        )
      ) {
        // Add the ScheduledActivity to the schedule
        schedule.push({ ...activity, activityStartTime, activityEndTime });

        // Remove the activity from the graph
        graph.removeNode(activity.id);

        // Update the timeslots for activity duration
        for (let i = currentTimeSlot; i <= activityEndTime; i++) {
          // Again, if no activities have already been scheduled in given time slot, initialize the time slot
          if (!timeSlots[i]) {
            timeSlots[i] = {
              peopleAvailable: peopleAvailable,
              plannedActivityIds: [activity.id],
              totalRevealingness: 0, // Initialize to -1 as a placeholder, will be updated in a later moment of the while loop
            };
          }
          // Update the time slot with the activity's expected duration
          timeSlots[i].peopleAvailable -= activity.people_required;
          timeSlots[i].totalRevealingness += activity.level_of_revealingness;
          timeSlots[i].plannedActivityIds.push(activity.id);
        }

        // Update the revealingness of the activity
      }
    });

    // Update weightOfRevealingness based on how far the current revealingness is from the soft maximum
    weightOfRevealingness +=
      0.5 *
      (timeSlots[currentTimeSlot].totalRevealingness -
        softMaximumOfRevealingness);

    // Update weightOfResources based on the remaining project duration
    weightOfResources -= initialResourceWeight / expectedProjectDuration;

    // Update the current time slot
    currentTimeSlot += 1;
  }

  // Calculate the total cost based on the number of time slots used
  return {
    schedule: schedule,
    totalCost: currentTimeSlot * dailyProjectCost,
  };
}

function activityCanBeScheduled(
  activity: Activity,
  currentTimeSlot: number,
  timeSlots: TimeSlots,
  orderedActivities: Activity[],
  activityStartTime: number,
  activityEndTime: number,
  scheduledActivities: ScheduledActivity[],
  maximumSimultaniousRevealingness: number
) {
  // 1 - Check if there are enough people available in all time slots
  for (let i = activityStartTime; i <= activityEndTime; i++) {
    if (timeSlots[i] === undefined) {
      continue; // Skip if the time slot is not defined
    }

    const timeSlot = timeSlots[i];
    const peopleAvailableAtTimeSlot = timeSlot.peopleAvailable ?? Infinity;

    if (peopleAvailableAtTimeSlot < activity.people_required) {
      return false; // Not enough people available
    }

    const revealingnessAtTimeSlot = timeSlot.totalRevealingness ?? 0;
    if (
      revealingnessAtTimeSlot + activity.level_of_revealingness >
      maximumSimultaniousRevealingness
    ) {
      return false; // Revealingness exceeds the hard maximum
    }
  }

  // 2 - Check if the activity depends on any other activity that is not yet scheduled
  for (const activity of orderedActivities) {
    const dependsOnQueuedActivity = activity.dependencies.find(
      (dependency) => dependency === activity.id
    );

    if (dependsOnQueuedActivity) {
      return false; // Activity cannot be scheduled yet
    }
  }

  // 3 - Check if all dependencies in the schedule are completed before the activity starts
  if (
    activity.dependencies.some(
      (dependency) =>
        !scheduledActivities.some(
          (scheduledActivity) =>
            scheduledActivity.id === dependency &&
            scheduledActivity.activityEndTime <= activityStartTime
        )
    )
  ) {
    return false; // Dependency is not yet completed
  }

  console.debug(
    `activityCanBeScheduled - Activity '${activity.activity.trim()}' can be scheduled at time slot ${currentTimeSlot}.`
  );
  return true; // Activity can be scheduled
}
