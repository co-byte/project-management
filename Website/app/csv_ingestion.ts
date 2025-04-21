import * as path from "path";
import * as dfd from "danfojs-node";
import { from, lastValueFrom, of, throwError } from "rxjs";
import { map, catchError, switchMap } from "rxjs/operators";

export function ingestCSV(filePath: string) {
  const absolutePath = path.resolve(filePath);

  return from(dfd.readCSV(absolutePath, { delimiter: ";" })).pipe(
    map((df) => {
      // Ensure the required columns exist
      if (!df.columns.includes("duration") || !df.columns.includes("weight")) {
        throw new Error("CSV must contain 'duration' and 'weight' columns.");
      }
      return df;
    }),
    switchMap((df) => {
      // Calculate the weighted average for each row
      const expectedDuration = df["duration"]
        .mul(df["weight"])
        .div(df["weight"].sum());
      df.addColumn("expected_duration", expectedDuration, { inplace: true });
      return of(df);
    }),
    catchError((error) =>
      throwError(() => new Error(`Error processing CSV: ${error.message}`))
    )
  );
}

(async () => {
  try {
    const processedDf = await lastValueFrom(ingestCSV("./input.csv"));
    console.log("Processed DataFrame:");
    processedDf.print(); // Print the DataFrame with the new column
  } catch (error) {
    console.error("Error:", error);
  }
})();
