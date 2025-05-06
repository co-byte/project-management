  import * as path from "path";
  import * as fs from "fs";
  import { runScheduleWithParameters } from "../main";
  import { runSimulation } from "./schedule_simulator"; // Ensure this file & function exist and are exported


  // === Configure the different cases ===
  const Configs = [
      // === KART 8 People ===
    {
      name: "kart_8_people_conservative",
      csvInputPath: "./Website/data/input.csv",
      jsonOutputPath: "./Website/data/v2/schedules/kart_8_people_conservative.json",
      totalPeople: 8,
      dailyProjectCost: 200,
      expectedProjectDuration: 100,
      initialResourceWeight: 2,
      initialRevealingnessWeight: 1,
      softMaximumOfRevealingness: 4,
      hardMaximumOfRevealingsness: 8,
      revealingnessDecayRate: 0.70,
      startTimeSlot: 0,
      startRevealingness: 0,
    },
    {
      name: "kart_8_people_balanced",
      csvInputPath: "./Website/data/input.csv",
      jsonOutputPath: "./Website/data/v2/schedules/kart_8_people_balanced.json",
      totalPeople: 8,
      dailyProjectCost: 200,
      expectedProjectDuration: 75,
      initialResourceWeight: 4,
      initialRevealingnessWeight: 1,
      softMaximumOfRevealingness: 7,
      hardMaximumOfRevealingsness: 11,
      revealingnessDecayRate: 0.67,
      startTimeSlot: 0,
      startRevealingness: 0,
    },
    {
      name: "kart_8_people_aggressive",
      csvInputPath: "./Website/data/input.csv",
      jsonOutputPath: "./Website/data/v2/schedules/kart_8_people_aggressive.json",
      totalPeople: 8,
      dailyProjectCost: 200,
      expectedProjectDuration: 60,
      initialResourceWeight: 10,
      initialRevealingnessWeight: 1,
      softMaximumOfRevealingness: 16,
      hardMaximumOfRevealingsness: 16,
      revealingnessDecayRate: 0.65,
      startTimeSlot: 0,
      startRevealingness: 0,
    },
    // === KART 6 People ===
    {
      name: "kart_6_people_conservative",
      csvInputPath: "./Website/data/input.csv",
      jsonOutputPath: "./Website/data/v2/schedules/kart_6_people_conservative.json",
      totalPeople: 6,
      dailyProjectCost: 200,
      expectedProjectDuration: 100,
      initialResourceWeight: 2,
      initialRevealingnessWeight: 1,
      softMaximumOfRevealingness: 5,
      hardMaximumOfRevealingsness: 9,
      revealingnessDecayRate: 0.70,
      startTimeSlot: 0,
      startRevealingness: 0,
    },
    {
      name: "kart_6_people_balanced",
      csvInputPath: "./Website/data/input.csv",
      jsonOutputPath: "./Website/data/v2/schedules/kart_6_people_balanced.json",
      totalPeople: 6,
      dailyProjectCost: 200,
      expectedProjectDuration: 75,
      initialResourceWeight: 4,
      initialRevealingnessWeight: 1,
      softMaximumOfRevealingness: 7,
      hardMaximumOfRevealingsness: 11,
      revealingnessDecayRate: 0.67,
      startTimeSlot: 0,
      startRevealingness: 0,
    },
    {
      name: "kart_6_people_aggressive",
      csvInputPath: "./Website/data/input.csv",
      jsonOutputPath: "./Website/data/v2/schedules/kart_6_people_aggressive.json",
      totalPeople: 6,
      dailyProjectCost: 200,
      expectedProjectDuration: 60,
      initialResourceWeight: 10,
      initialRevealingnessWeight: 1,
      softMaximumOfRevealingness: 16,
      hardMaximumOfRevealingsness: 16,
      revealingnessDecayRate: 0.65,
      startTimeSlot: 0,
      startRevealingness: 0,
    },
    // === RCP 6 People ===
    {
      name: "rcp_6_people",
      jsonOutputPath: "./Website/data/v2/schedules/rcp_6_people.json",
      totalPeople: 6,
      dailyProjectCost: 200,
    },
    // === RCP 8 People ===
    {
      name: "rcp_8_people",
      jsonOutputPath: "./Website/data/v2/schedules/rcp_8_people.json",
      totalPeople: 8,
      dailyProjectCost: 200,
    },
  ];

  (async () => {
    for (const config of Configs) {
      console.log(`\n=== Running schedule for: ${config.name} ===`);

      // Step 1: Only run scheduler if csvInputPath is present
      if (config.csvInputPath && runScheduleWithParameters) {
        await runScheduleWithParameters(config);
      }

      // Step 2: Prepare paths for simulation
      const simulationInput = config.jsonOutputPath;

      // Determine result folder based on totalPeople
      const peopleGroup = config.totalPeople === 6 ? "kartel_6_people" : "kartel_8_people";

      // Get base filename (e.g., kart_6_people_balanced.json)
      const baseName = path.basename(simulationInput);

      // Construct final output path
      const simulationOutputDir = path.join("./Website/data/v2/results", peopleGroup);
      const simulationOutputPath = path.join(simulationOutputDir, baseName);

      // Ensure the output directory exists
      fs.mkdirSync(simulationOutputDir, { recursive: true });

      // Step 3: Run the simulation
      console.log(`Running simulation for: ${config.name}`);
      await runSimulation({
        inputFile: simulationInput,
        outputFile: simulationOutputPath,
        totalPeople: config.totalPeople,
        baseCostPerDay: config.dailyProjectCost,
        decayFactor: 0.02,
        amountOfLoops: 1000,
      });

      console.log(`✅ Simulation complete: ${simulationOutputPath}`);
    }
  })();