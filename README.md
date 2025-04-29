# project-management

Navigate to `/planning-application/project-management`.

## Executing the planning scripts

To plan the project using PERT and KART, execute:

```bash
npx ts-node .\Website\app\PERT_GANTT_scheduler.ts
npx ts-node .\Website\app\KART_scheduler\main.ts
```

## Displaying the Gantt charts

Run `http-server ./Website -p 8000 --spa` and navigate to `localhost:8000` to view the resulting Gant charts.

## Explanation of the algorithm

- Parallel Schedule Generation Scheme
- Earliest start time (Critical path based) while trying to minimize the concurrent "revealingness" levels at any given time.
