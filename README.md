# project-management

Navigate to `/planning-application/project-management`.

## Executing the planning scripts

To plan the project using PERT and KART, execute:

```bash
npx ts-node .\Website\app\PERT_GANTT_scheduler.ts
npx ts-node .\Website\app\KART_GANTT_scheduler.ts
```

## Displaying the Gantt charts

Run `http-server ./Website -p 8000 --spa` and navigate to `localhost:8000` to view the resulting Gant charts.
