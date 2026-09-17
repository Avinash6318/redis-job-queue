import { listDLQ } from "./deadLetterQueue";

async function main() {
  const entries = await listDLQ();
  console.log(`DLQ has ${entries.length} entries:`);
  console.log(JSON.stringify(entries, null, 2));
  process.exit(0);
}

main();