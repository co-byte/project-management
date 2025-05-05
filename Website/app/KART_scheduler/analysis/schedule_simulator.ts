import * as fs from "fs";
import * as path from "path";

interface RevealingnessValues {
  [key: number]: number;
}

interface ChanceValues {
  [key: number]: number;
}

interface Activity {
  id: string;
  start: number;
  expected_duration: number;
  monetary_cost_per_day: number;
  people_required: number;
  level_of_revealingness: number;
  chance_of_delays: number;
  weight_of_delays: number;
  chance_of_losing_people: number;
  weight_of_losing_people: number;
  dependencies: string[];
  end?: number;
  finishedAt?: number;
  revealDecay50?: boolean;
  revealDecay100?: boolean;
}

interface SimulationResult {
  totalCost: number;
  totalDelayDays: number;
  peopleLeft: number;
  delays: { activity: string; revealingnessFactor: string }[];
  peopleLost: { activity: string; revealingnessFactor: string }[];
  finishedActivities: string[];
  projectFinished: boolean;
  unfinishedActivities: string[];
  failingActivity: Activity | null;
  totalProjectDuration: number;
  total: number;
}

interface RunSimulationOptions {
  inputFile: string;
  outputFile: string;
  totalPeople?: number;
  amountOfLoops?: number;
  batchSize?: number;
  decayFactor?: number;
  revealingnessValues?: RevealingnessValues;
  chanceValues?: ChanceValues;
  completionReward?: number;
  baseCostPerDay?: number;
}

export function runSimulation({
  inputFile,
  outputFile,
  totalPeople = 8,
  amountOfLoops = 1000,
  batchSize = 100,
  decayFactor = 0.9,
  revealingnessValues = {
    1: 0.05,
    2: 0.075,
    3: 0.1,
    4: 0.15,
    5: 0.2,
  },
  chanceValues = {
    1: 0.05,
    2: 0.1,
    3: 0.15,
    4: 0.225,
    5: 0.3,
  },
  completionReward = 150000,
  baseCostPerDay = 200,
}: RunSimulationOptions): void {
  let availablePeople: number;
  let globalRevealingness: number;
  let currentTime: number;
  let currentDecayTime: number;
  let totalCost: number;
  let totalDelayDays: number;
  let blocked: boolean;
  let failingActivity: Activity | null;
  let unfinishedActivities: string[];
  let delays: { activity: string; revealingnessFactor: string }[];
  let peopleLost: { activity: string; revealingnessFactor: string }[];
  let done: Activity[];
  let inProgress: Activity[];
  let results: SimulationResult[];

  const calculateEffectiveChance = (base: number, scale: number): number =>
    base * (1 + scale);

  function resetState(): void {
    availablePeople = totalPeople;
    globalRevealingness = 0;
    currentTime = 0;
    currentDecayTime = 0;
    totalCost = 0;
    totalDelayDays = 0;
    blocked = false;
    failingActivity = null;
    unfinishedActivities = [];
    delays = [];
    peopleLost = [];
    done = [];
    inProgress = [];
  }

  function checkFinishedActivities(): void {
    for (let i = inProgress.length - 1; i >= 0; i--) {
      const activity = inProgress[i];
      if (currentTime >= (activity.end ?? (activity.end = currentTime + activity.expected_duration))) {
        if (currentTime < (activity.finishedAt ?? currentTime))
          activity.finishedAt = currentTime;
        done.push(activity);
        inProgress.splice(i, 1);
        availablePeople += activity.people_required;
        applyRevealingnessDecay();

        const delayChance = calculateEffectiveChance(
          chanceValues[activity.chance_of_delays],
          globalRevealingness
        );
        const peopleLossChance = calculateEffectiveChance(
          chanceValues[activity.chance_of_losing_people],
          globalRevealingness
        );

        if (Math.random() < delayChance) {
          totalDelayDays += activity.weight_of_delays;
          totalCost +=
            activity.weight_of_delays *
            activity.monetary_cost_per_day *
            activity.people_required;
          delays.push({
            activity: activity.id,
            revealingnessFactor: globalRevealingness.toFixed(3),
          });
        }

        if (Math.random() < peopleLossChance) {
          availablePeople -= activity.weight_of_losing_people;
          peopleLost.push({
            activity: activity.id,
            revealingnessFactor: globalRevealingness.toFixed(3),
          });
          if (availablePeople < 0) availablePeople = 0;
        }

        activity.revealDecay50 = false;
        activity.revealDecay100 = false;
      }
    }
  }

  function applyRevealingnessDecay(): void {
    let daysPassed = currentTime - currentDecayTime;
    if (daysPassed !== 0) {
      globalRevealingness -= decayFactor * daysPassed;
      currentDecayTime = currentTime;
    }
  }

  function startEligibleActivities(toDo: Activity[]): void {
    for (let i = toDo.length - 1; i >= 0; i--) {
      const activity = toDo[i];
      const dependenciesMet = activity.dependencies.every((id) =>
        done.some((d) => d.id === id)
      );
      if (
        activity.start <= currentTime &&
        dependenciesMet &&
        availablePeople >= activity.people_required
      ) {
        const revealAdd =
          revealingnessValues[activity.level_of_revealingness] || 0;
        globalRevealingness += revealAdd;
        totalCost +=
          activity.expected_duration *
          activity.monetary_cost_per_day *
          activity.people_required;
        availablePeople -= activity.people_required;
        inProgress.push(activity);
        toDo.splice(i, 1);
      }
    }
  }

  function simulateStep(toDo: Activity[]): void {
    checkFinishedActivities();
    startEligibleActivities(toDo);
    currentTime += 1;
  }

  function checkIfBlocked(toDo: Activity[]): void {
    const readyActivities = toDo.filter(
      (a) =>
        a.start <= currentTime &&
        a.dependencies.every((depId) => done.some((d) => d.id === depId))
    );
    const anyCanStart = readyActivities.some(
      (a) => a.people_required <= availablePeople
    );
    if (!anyCanStart && readyActivities.length > 0 && inProgress.length === 0) {
      blocked = true;
      failingActivity = readyActivities[0];
    }
  }

  function simulateProject(schedule: Activity[]): boolean {
    const toDo = [...schedule];
    while (toDo.length > 0 || inProgress.length > 0) {
      checkIfBlocked(toDo);
      if (blocked) {
        unfinishedActivities.push(...toDo.map((a) => a.id));
        return false;
      }
      simulateStep(toDo);
    }
    return true;
  }

  function printFinalResult(projectFinished: boolean): SimulationResult {
    const totalProjectDuration = currentTime;
    totalCost += totalProjectDuration * baseCostPerDay;
    const total = completionReward - totalCost;

    return {
      totalCost: Math.round(totalCost),
      totalDelayDays,
      peopleLeft: availablePeople,
      delays,
      peopleLost,
      finishedActivities: done.map((a) => a.id),
      projectFinished,
      unfinishedActivities,
      failingActivity,
      totalProjectDuration,
      total,
    };
  }

  function getScheduleFromFile(filePath: string): Activity[] | null {
    const absolutePath = path.resolve(filePath);
    try {
      const data = fs.readFileSync(absolutePath, "utf-8");
      return JSON.parse(data).schedule;
    } catch (err) {
      console.error("Error reading schedule:", err);
      return null;
    }
  }

  // === Main Execution ===
  const schedule = getScheduleFromFile(inputFile);
  if (!schedule) return;

  results = [];

  fs.writeFileSync(outputFile, "[\n");

  for (let i = 0; i < amountOfLoops; i++) {
    resetState();
    const tempSchedule = JSON.parse(JSON.stringify(schedule)) as Activity[];
    const projectFinished = simulateProject(tempSchedule);
    const result = printFinalResult(projectFinished);
    results.push(result);

    const isLastBatch = i === amountOfLoops - 1;
    if (results.length === batchSize || isLastBatch) {
      const jsonChunk =
        results.map((r) => JSON.stringify(r, null, 2)).join(",\n") +
        (isLastBatch ? "\n" : ",\n");
      fs.appendFileSync(outputFile, jsonChunk);
      results = [];
    }
  }

  fs.appendFileSync(outputFile, "]"); // End JSON array
}
