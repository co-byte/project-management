import { ingestCSV } from "./csv_ingestion_tib";
import { Graph, Edge } from "graphlib";
import { lastValueFrom } from "rxjs";

function calculateExpectedDuration(
  optimistic: number,
  realistic: number,
  pessimistic: number
): number {
  // Guard against NaN and undefined durations
  if (isNaN(optimistic) || isNaN(realistic) || isNaN(pessimistic)) {
    console.warn(
      `Invalid durations: O=${optimistic}, M=${realistic}, P=${pessimistic}`
    );
    return 0; // Return a default valid duration if inputs are incorrect
  }
  return (optimistic + 4 * realistic + pessimistic) / 6;
}

// Build graph from activities
function buildGraph(activities: any[]): Graph {
  const g = new Graph();

  activities.forEach((act: any) => {
    g.setNode(act.id, {
      ...act,
      expected_duration: calculateExpectedDuration(
        act.optimistic_duration,
        act.likely_duration,
        act.pessimistic_duration
      ),
    });

    act.dependencies.forEach((dep: string) => {
      const cleanDep = dep?.trim();
      if (cleanDep && cleanDep !== "/") {
        g.setEdge(cleanDep, act.id);
      }
    });
  });

  return g;
}

// Topological sort
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
    throw new Error("The graph contains a cycle.");
  }

  return sorted;
}

// Calculate critical path
function calculateCriticalPath(graph: Graph): {
  path: string[];
  duration: number;
} {
  const earliest: Record<string, number> = {};
  const latest: Record<string, number> = {};

  const topOrder = topologicalSort(graph);

  console.log("Topological Order:", topOrder);

  // Forward pass with proper initialization of earliest times
  for (const node of topOrder) {
    // Initialize earliest time for nodes with no dependencies (root tasks)
    if (graph.inEdges(node)?.length === 0) {
      earliest[node] = 0;
    } else {
      // Calculate earliest times based on predecessor finish times
      const inEdges = graph.inEdges(node);
      const preds = inEdges?.map((e) => {
        const predEarliest = earliest[e.v] || 0; // Ensure predEarliest is not undefined
        const predDuration = graph.node(e.v)?.expected_duration || 0; // Ensure predDuration is not undefined
        const predFinish = predEarliest + predDuration; // Finish time of the predecessor
        console.log(
          `  -> ${e.v} (earliest: ${predEarliest}, duration: ${predDuration}, finish: ${predFinish})`
        );
        return predFinish;
      }) || [0];

      // Update earliest start time based on the maximum of predecessor finish times
      earliest[node] = Math.max(...preds);
    }

    // Log the calculated earliest start time for the current node
    console.log(`Earliest start for ${node}: ${earliest[node]}`);
  }

  // Debug: Show all earliest values
  console.log("Earliest Times:", earliest);

  // Check all nodes and durations before computing projectDuration
  topOrder.forEach((n) => {
    const e = earliest[n];
    const d = graph.node(n)?.expected_duration;
    console.log(`Node ${n}: earliest = ${e}, duration = ${d}, sum = ${e + d}`);
  });

  const projectDuration = Math.max(
    ...topOrder.map((n) => earliest[n] + graph.node(n).expected_duration)
  );

  console.log(`FINAL PROJECT DURATION: ${projectDuration}`);

  // Backward pass (optional: can add debug here too)
  for (let i = topOrder.length - 1; i >= 0; i--) {
    const node = topOrder[i];
    const outEdges = graph.outEdges(node);

    if (!outEdges || outEdges.length === 0) {
      latest[node] = projectDuration - graph.node(node).expected_duration;
    } else {
      const minSucc = outEdges.map((e) => {
        const successorLatest = latest[e.w];
        return (
          (successorLatest !== undefined ? successorLatest : projectDuration) -
          graph.node(e.w).expected_duration
        );
      });
      latest[node] = Math.min(...minSucc);
    }
  }

  const path = topOrder.filter((id) => earliest[id] === latest[id]);

  return { path, duration: projectDuration };
}

// Main function
(async () => {
  try {
    const rows = await lastValueFrom(ingestCSV("Website/data/input.csv"));

    const dependencies: Record<string, string[]> = {};
    rows.forEach((row: any) => {
      const rawDeps = row.predecessor?.trim();
      const deps = rawDeps && rawDeps !== "/" ? rawDeps.split(",") : [];
      dependencies[row.wbs_code] = deps.map((d: string) => d.trim());
    });

    const activities = rows.map((row: any) => ({
      id: row.wbs_code,
      activity: row.activity,
      optimistic_duration: parseFloat(row.optimistic_duration),
      likely_duration: parseFloat(row.likely_duration),
      pessimistic_duration: parseFloat(row.pessimistic_duration),
      dependencies: dependencies[row.wbs_code] || [],
    }));

    const graph = buildGraph(activities);
    console.log("Graph nodes:", graph.nodes());
    console.log("Graph edges:", graph.edges());

    const { path, duration } = calculateCriticalPath(graph);

    console.log("Critical Path:");
    path.forEach((nodeId) => {
      const act = graph.node(nodeId);
      console.log(
        `- ${act.id}: ${act.activity} (${act.expected_duration.toFixed(2)}d)`
      );
    });

    console.log(
      `\nTotal Expected Project Duration: ${duration.toFixed(2)} days`
    );
  } catch (error) {
    console.error("Error:", error);
  }
})();
