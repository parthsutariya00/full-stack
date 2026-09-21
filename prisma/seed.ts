import { PrismaClient, TaskPriority, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

type SeedTask = {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
};

type SeedProject = {
  name: string;
  description: string;
  color: string;
  tasks: SeedTask[];
};

const SEED_PROJECTS: SeedProject[] = [
  {
    name: "Website redesign",
    description: "Marketing site refresh for the Q4 launch.",
    color: "#6366f1",
    tasks: [
      {
        title: "Audit current pages",
        description: "List every page and mark keep / merge / drop.",
        status: TaskStatus.DONE,
        priority: TaskPriority.MEDIUM,
        dueDate: daysFromNow(-6),
      },
      {
        title: "Design new hero section",
        description: "Two directions, dark and light.",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        dueDate: daysFromNow(3),
      },
      {
        title: "Waiting on brand photography",
        description: "Blocked until the shoot is delivered.",
        status: TaskStatus.BLOCKED,
        priority: TaskPriority.LOW,
        dueDate: null,
      },
      {
        title: "Ship pricing page copy",
        description: null,
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        dueDate: daysFromNow(-1),
      },
    ],
  },
  {
    name: "Platform hardening",
    description: "Reliability work before opening the beta.",
    color: "#10b981",
    tasks: [
      {
        title: "Add connection pooling",
        description: "PgBouncer in front of the primary.",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        dueDate: daysFromNow(9),
      },
      {
        title: "Backfill task indexes",
        description: "Composite index on (projectId, status).",
        status: TaskStatus.DONE,
        priority: TaskPriority.MEDIUM,
        dueDate: daysFromNow(-3),
      },
      {
        title: "Write runbook for incidents",
        description: null,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: daysFromNow(5),
      },
    ],
  },
];

async function main(): Promise<void> {
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();

  for (const project of SEED_PROJECTS) {
    await prisma.project.create({
      data: {
        name: project.name,
        description: project.description,
        color: project.color,
        tasks: { create: project.tasks },
      },
    });
  }

  const projects = await prisma.project.count();
  const tasks = await prisma.task.count();
  console.log(`Seeded ${projects} projects and ${tasks} tasks.`);
}

main()
  .catch((caught) => {
    console.error(caught instanceof Error ? caught.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
