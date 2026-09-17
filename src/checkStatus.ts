import { getJobState } from "./jobState";

async function main() {
  const jobId = Number(process.argv[2]);
  if (!jobId) {
    console.log("Usage: npm run status <jobId>");
    process.exit(1);
  }
  const state = await getJobState(jobId);
  console.log("Job state:", state);
  process.exit(0);
}

main();