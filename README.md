# project-management

> **Disclaimer**: This project was developed solely as a Proof of Concept (PoC), corporate talk for a codebase with duplicate files and less-than-optimal organization.

This project provides tools for project scheduling and simulation using PERT and KART methodologies.

## Viewing the Gantt Charts

To visualize the generated schedules as Gantt charts:

1. Start a local HTTP server in the `Website` directory:

    ```bash
    http-server ./Website -p 8000 --spa
    ```

2. Open your browser and navigate to `http://localhost:8000`.

The Gantt charts will display the schedules located in `./Website/data/v2/schedules/`.

> **Note**: Since the Gantt charts are served as static files, any changes to the schedules will require a browser refresh to reflect the updates.

## Running the Planning Scripts

To generate project schedules using PERT and KART, run the following commands:

```bash
npx ts-node ./Website/app/PERT_GANTT_scheduler.ts    # PERT-based scheduling
npx ts-node ./Website/app/KART_scheduler/main.ts     # KART-based scheduling
```

These scripts process the input data located at `./Website/data/input.csv` and generate schedules in the `./Website/data/v2/schedules/` directory.

## Running the simulation

To manually run the simulation, execute: `node .\Website\app\Schedule_runner.js`

## Using the script to schedule & simulate

The script located at `./Website/app/KART_scheduler/analysis/kart_run.ts` automates the scheduling and simulation process for multiple configurations. It reads predefined configurations, generates schedules, and runs simulations. To execute the script, run:

```bash
npx ts-node ./Website/app/KART_scheduler/analysis/kart_run.ts
```

This will process all configurations and save the results in the appropriate directories under `./Website/data/v2/results/`.

## Data Analysis

For analyzing the results of the simulations, a Jupyter Notebook is available at:

`./Website/app/data_analysis.ipynb`

This notebook provides utilities for processing simulation data, generating visualizations, and summarizing key metrics. Open the notebook in Jupyter or any compatible environment to explore the results.
