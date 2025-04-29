const fs = require('fs');
const path = require('path');

const REVEALINGNESS_VALUES = {
    1: 0.05,
    2: 0.075,
    3: 0.10,
    4: 0.15,
    5: 0.20
};
  
const CHANCE_VALUES = {
    1: 0.05,
    2: 0.10,
    3: 0.15,
    4: 0.225,
    5: 0.30
};
  
const TOTAL_PEOPLE = 5;
let availablePeople = TOTAL_PEOPLE;
let globalRevealingness = 0;
let currentTime = 0;
let totalCost = 0;
let totalDelayDays = 0;

const delays = [];
const peopleLost = [];
const done = [];
const inProgress = [];
  
function log(...args) {
    console.log(...args);
}
  
function calculateEffectiveChance(base, scale) {
    return base * (1 + scale);
}

function checkFinishedActivities() {
    for (let i = inProgress.length - 1; i >= 0; i--) {
        const activity = inProgress[i];
        if (currentTime >= activity.end) {
        log(`Finished ${activity.activity} at time ${currentTime}`);
        activity.finishedAt = currentTime;
        done.push(activity);
        inProgress.splice(i, 1);
        availablePeople += activity.people_required;

        const delayChance = calculateEffectiveChance(CHANCE_VALUES[activity.chance_of_delays], globalRevealingness);
        const peopleLossChance = calculateEffectiveChance(CHANCE_VALUES[activity.chance_of_losing_people], globalRevealingness);

        if (Math.random() < delayChance) {
            totalDelayDays += activity.weight_of_delays;
            const delayCost = activity.weight_of_delays * activity.monetary_cost_per_day * activity.people_required;
            totalCost += delayCost;
            delays.push({ activity: activity.id, revealingnessFactor: globalRevealingness.toFixed(3) });
            log(`Delay in ${activity.activity} (Chance: ${(delayChance * 100).toFixed(1)}%)`);
        }

        if (Math.random() < peopleLossChance) {
            availablePeople -= activity.weight_of_losing_people;
            peopleLost.push({ activity: activity.id, revealingnessFactor: globalRevealingness.toFixed(3) });
            log(`Lost ${activity.weight_of_losing_people} people in ${activity.activity} (Chance: ${(peopleLossChance * 100).toFixed(1)}%)`);
            if (availablePeople < 0) availablePeople = 0;
        }

        activity.revealDecay50 = false;
        activity.revealDecay100 = false;
        }
    }
}
  
function applyRevealingnessDecay() {
    for (const activity of done) {
        const revealVal = REVEALINGNESS_VALUES[activity.level_of_revealingness];
        const timeSinceEnd = currentTime - activity.finishedAt;

        if (!activity.revealDecay50 && timeSinceEnd >= activity.expected_duration * 0.5) {
        globalRevealingness -= revealVal * 0.5;
        activity.revealDecay50 = true;
        log(`Partial decay from ${activity.activity}: -${(revealVal * 0.5).toFixed(3)}`);
        }

        if (!activity.revealDecay100 && timeSinceEnd >= activity.expected_duration * 0.75) {
        globalRevealingness -= revealVal * 0.5;
        activity.revealDecay100 = true;
        log(`Full decay from ${activity.activity}: -${(revealVal * 0.5).toFixed(3)}`);
        }
    }
}

function startEligibleActivities(toDo) {
    for (let i = toDo.length - 1; i >= 0; i--) {
        const activity = toDo[i];
        const dependenciesMet = activity.dependencies.every(depId =>
        done.some(d => d.id === depId)
        );

        if (activity.start <= currentTime && dependenciesMet && availablePeople >= activity.people_required) {
        log(`Starting ${activity.activity} at time ${currentTime}`);
        const revealAdd = REVEALINGNESS_VALUES[activity.level_of_revealingness] || 0;
        globalRevealingness += revealAdd;
        log(`Revealingness increased by ${revealAdd.toFixed(3)} → Total: ${globalRevealingness.toFixed(3)}`);

        const cost = activity.expected_duration * activity.monetary_cost_per_day * activity.people_required;
        totalCost += cost;
        availablePeople -= activity.people_required;

        inProgress.push(activity);
        toDo.splice(i, 1);
        }
    }
}

function simulateStep(toDo) {
    checkFinishedActivities();
    applyRevealingnessDecay();
    startEligibleActivities(toDo);
    currentTime += 1;
}

function simulateProject(schedule) {
    const toDo = [...schedule];
    while (toDo.length > 0 || inProgress.length > 0) {
        const canStartSomething = toDo.some(a => a.start <= currentTime && a.people_required <= availablePeople);
        if (!canStartSomething && inProgress.length === 0) {
            log("Not enough people to proceed. Project halted.");
            
            return false;
        }
        simulateStep(toDo);
    }
    return true;
}

function printFinalResult(projectFinished, schedule) {
    const result = {
        totalCost: Math.round(totalCost),
        totalDelayDays,
        peopleLeft: availablePeople,
        delays,
        peopleLost,
        finishedActivities: done.map(a => a.id),
        projectFinished
    };

    console.log("\n FINAL RESULT:");
    console.log(JSON.stringify(result, null, 2));
}
  
// ======= MAIN =========
function getSchedule(){
    // Path to your schedule JSON
    const jsonOutputPath = path.resolve(__dirname, "../data/schedule_kart.json");

    let schedule;
    try {
        const data = fs.readFileSync(jsonOutputPath, 'utf-8');
        const parsed = JSON.parse(data);
        schedule = parsed.schedule; // Grabs the schedule array from the object
        return schedule
    } catch (err) {
        console.error("Failed to read or parse the schedule JSON:", err);
        process.exit(1);
    }
}
let schedule = getSchedule();
const projectFinished = simulateProject(schedule);
printFinalResult(projectFinished, schedule);
