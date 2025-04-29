/**
 * Utility Functions for Project Management Scheduler
 *
 * This file contains static utility functions for processing project data,
 * including calculating dependencies, transforming rows into activities,
 * and building a graph representation of activities and their dependencies.
 *
 * Functions:
 * - calculateDependencies: Extracts dependencies from project rows.
 * - calculateActivities: Transforms rows into Activity objects with calculated durations.
 * - buildGraph: Constructs a directed graph of activities and their dependencies.
 *
 * Dependencies:
 * - Requires the `graphlib` library for graph operations.
 * - Relies on `Activity` and `Row` interfaces for type definitions.
 *
 * Notes:
 * - Ensure that input rows conform to the `Row` interface for proper functionality.
 * - The `calculateExpectedDuration` function must be imported from another module.
 */

import { Activity } from "../entities/activity";
import { Graph } from "graphlib";
import { Row } from "../entities/row";
import { calculateExpectedDuration } from "./transformations";

// === Calculate Dependencies ===
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

// === Transform CSV (undefined) rows to Activities ===
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

// === Graph Construction ===
export function buildGraph(activities: Activity[]): Graph {
  const g = new Graph();

  activities.forEach((act) => {
    // console.debug("buildGraph - Adding node:", act.id, act.activity);

    g.setNode(act.id, act);
    act.dependencies.forEach((dep: string) => {
      if (dep && dep.trim() && dep !== "/") {
        // console.debug("buildGraph - Adding edge:", dep.trim(), act.id);
        g.setEdge(dep.trim(), act.id);
      }
    });
  });

  console.debug("buildGraph - Graph nodes:");
  g.nodes().forEach((node) => {
    console.debug(" - ",node, "activity='",g.node(node).activity.trim(), "'\t| revealingness=",g.node(node).level_of_revealingness), " | ...";
  });
  return g;
}
