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
let CompletionReward = 150000;
let baseCostPerDay = 200;  
let failingActivity;  
let unfinishedActivities = [];
const TOTAL_PEOPLE = 8;
let availablePeople = TOTAL_PEOPLE;
let globalRevealingness = 0;
let currentTime = 0;
let currentDecayTime = 0;
let decayFactor = 0.9;
let totalCost = 0;
let totalDelayDays = 0;

let delays = [];
let peopleLost = [];
let done = [];
let inProgress = [];

let results =[];

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
            //log(`Finished ${activity.activity} at time ${currentTime}`);
            if(currentTime < activity.finishedAt){
                activity.finishedAt = currentTime;
            }
            done.push(activity);
            inProgress.splice(i, 1);
            availablePeople += activity.people_required;
            // applyPossibleRevealingnessDecay()
            applyRevealingnessDecay();

            const delayChance = calculateEffectiveChance(CHANCE_VALUES[activity.chance_of_delays], globalRevealingness);
            const peopleLossChance = calculateEffectiveChance(CHANCE_VALUES[activity.chance_of_losing_people], globalRevealingness);

            if (Math.random() < delayChance) {
                totalDelayDays += activity.weight_of_delays;
                const delayCost = activity.weight_of_delays * activity.monetary_cost_per_day * activity.people_required;
                totalCost += delayCost;
                delays.push({ activity: activity.id, revealingnessFactor: globalRevealingness.toFixed(3) });
                //log(`Delay in ${activity.activity} (Chance: ${(delayChance * 100).toFixed(1)}%)`);
            }

            if (Math.random() < peopleLossChance) {
                availablePeople -= activity.weight_of_losing_people;
                peopleLost.push({ activity: activity.id, revealingnessFactor: globalRevealingness.toFixed(3) });
                //log(`Lost ${activity.weight_of_losing_people} people in ${activity.activity} (Chance: ${(peopleLossChance * 100).toFixed(1)}%)`);
                if (availablePeople < 0) availablePeople = 0;
            }

            activity.revealDecay50 = false;
            activity.revealDecay100 = false;
        }
    }
}

function applyPossibleRevealingnessDecay(){
    let amountOfDaysPassed = currentTime - currentDecayTime;
    currentDecayTime = currentTime;
    //log(`Days of decay ${amountOfDaysPassed} with current revealingness ${globalRevealingness}, total decay loss ${decayFactor**amountOfDaysPassed}`)
    if(amountOfDaysPassed != 0 ){
        globalRevealingness = globalRevealingness * (decayFactor**amountOfDaysPassed)
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
            //log(`Starting ${activity.activity} at time ${currentTime}`);
            const revealAdd = REVEALINGNESS_VALUES[activity.level_of_revealingness] || 0;
            globalRevealingness += revealAdd;
            //log(`Revealingness increased by ${revealAdd.toFixed(3)} → Total: ${globalRevealingness.toFixed(3)}`);

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
    //applyRevealingnessDecay();
    startEligibleActivities(toDo);
    currentTime += 1;
}
let blocked = false;
function checkIfBlocked(a, toDo){
    const readyActivities = toDo.filter(a =>
        a.start <= currentTime &&
        a.dependencies.every(depId => done.some(d => d.id === depId))
    );
    const anyCanStart = readyActivities.some(a =>
        a.people_required <= availablePeople
    );
    //log(readyActivities)
    if (!anyCanStart && readyActivities.length > 0 && inProgress.length === 0) {
        //log("FAIL – All ready activities are blocked due to resource constraints.");
        //log("Current Time:", currentTime);
        //log("Available People:", availablePeople);
        //log("Ready Activities:", readyActivities);
        blocked = true;
        failingActivity = readyActivities[0]; // Or store all if you want
    }  
}
function simulateProject(schedule) {
    let toDo = [...schedule];
    while (toDo.length > 0 || inProgress.length > 0) {
        toDo.every(a => checkIfBlocked(a, toDo));
    
        if (blocked) {
            //log("Deadlock: Remaining activities are blocked.");
            
            toDo.every(a => unfinishedActivities.push(a.id))
            //log("failures")
            //log(toDo)
            for (let i = toDo.length - 1; i >= 0; i--) {
                const activity = toDo[i];
                const dependenciesMet = activity.dependencies.every(depId =>
                done.some(d => d.id === depId)
                );
            }
            return false;
        }
        //log("time")
        //log(currentTime)
        simulateStep(toDo);
    }
    return true;
}

function printFinalResult(projectFinished) {
    totalProjectDuration = currentTime - 0;
    totalCost = totalCost + (totalProjectDuration*baseCostPerDay);
    total = CompletionReward - totalCost;
    const result = {
        totalCost: Math.round(totalCost),
        totalDelayDays,
        peopleLeft: availablePeople,
        delays,
        peopleLost,
        finishedActivities: done.map(a => a.id),
        projectFinished,
        unfinishedActivities,
        failingActivity,
        totalProjectDuration,
        total
    };

    //log("\n FINAL RESULT:");
    //log(JSON.stringify(result, null, 2));
    return result;
}

outputFile="../data/input_KART_results.json"
inputFile = "../data/schedules/input_schedule_kart.json"
// ======= MAIN =========
function getSchedule(){
    // Path to your schedule JSON
    const jsonOutputPath = path.resolve(__dirname, inputFile);

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
const schedule = getSchedule();
let amountOfLoops = 1000;
batchSize=100
fs.writeFile(outputFile,"", function(err, result) {
    if(err) console.log('error', err);
});
// Initialize file
fs.writeFileSync(outputFile, "[\n");

for (let i = 0; i < amountOfLoops; i++) {
    let tempSchedule = JSON.parse(JSON.stringify(schedule));
    blocked = false;
    availablePeople = TOTAL_PEOPLE;
    globalRevealingness = 0;
    currentTime = 0;
    currentDecayTime = 0;
    decayFactor = 0.90;
    totalCost = 0;
    totalDelayDays = 0;

    delays = [];
    peopleLost = [];
    done = [];
    inProgress = [];
    unfinishedActivities = [];
    const projectFinished = simulateProject(tempSchedule);
    const result = printFinalResult(projectFinished);
    results.push(result);

    // Append every 50 or on the last iteration
    const isLastBatch = (i === amountOfLoops - 1);
    if (results.length === batchSize || isLastBatch) {
        const jsonChunk = results.map(r => JSON.stringify(r, null, 2)).join(",\n") + (isLastBatch ? "\n" : ",\n");
        fs.appendFileSync(outputFile, jsonChunk);
        results = []; // Clear buffer
    }
}
fs.appendFileSync(outputFile, "]"); // Close JSON array