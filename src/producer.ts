import { enqueue } from "./queue";
import { Job } from "./types";

async function main() {
  const jobs: Array<{ job: Job; priority: number }> = [
    {
      job: {
        id: 1,
        task: "send-welcome-email",
        payload: {
          email: "user@example.com",
        },
      },
      priority: 1,
    },
    {
      job: {
        id: 2,
        task: "generate-report",
        payload: {
          report: "monthly-sales",
        },
      },
      priority: 5,
    },
    {
      job: {
        id: 3,
        task: "resize-profile-image",
        payload: {
          imageId: "img-123",
        },
      },
      priority: 10,
    },
    {
      job: {
        id: 1,
        task: "duplicate-job-test",
      },
      priority: 3,
    },
  ];

  for (const { job, priority } of jobs) {
    await enqueue(job, priority);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Producer error:", err);
  process.exit(1);
});