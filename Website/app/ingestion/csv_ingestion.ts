import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import { from, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { Row } from "../entities/row";

export function ingestCSV(filePath: string) {
  const absolutePath = path.resolve(filePath);

  return from(
    new Promise<Row[]>((resolve, reject) => {
      const results: Row[] = [];

      fs.createReadStream(absolutePath)
        .pipe(csv({ separator: ";" }))
        .on("data", (data) => {
          const duration = parseFloat(data["optimistic_duration"]);
          const weight = parseFloat(data["weight_of_delays"]);

          if (isNaN(duration) || isNaN(weight)) {
            console.warn(`Skipping invalid row: ${JSON.stringify(data)}`);
            return; // Skip this row if duration or weight is NaN
          }

          results.push({ ...data, duration, weight });
        })
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    })
  ).pipe(
    map((rows) => {
      if (rows.length === 0) {
        throw new Error("CSV is empty or missing valid rows.");
      }

      // Calculate total weight
      const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);

      // Handle case where totalWeight is 0 (to avoid division by zero)
      if (totalWeight === 0) {
        throw new Error(
          "Total weight is zero, cannot calculate expected durations."
        );
      }

      // Calculate expected durations based on the weighted average
      return rows.map((row) => ({
        ...row,
        expected_duration: (row.duration * row.weight) / totalWeight,
      }));
    }),
    catchError((error) =>
      throwError(() => new Error(`Error processing CSV: ${error.message}`))
    )
  );
}
