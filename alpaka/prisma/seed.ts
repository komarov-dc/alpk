import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface GlobalVariableData {
  name: string;
  value: string;
  description: string | null;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  canvasData: Prisma.InputJsonValue;
  globalVariables: GlobalVariableData[];
}

async function loadProjectFromFile(filename: string): Promise<ProjectData> {
  const filePath = path.join(__dirname, "seed-data", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as ProjectData;
}

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clean up existing data
  await prisma.globalVariable.deleteMany();
  await prisma.executionLog.deleteMany();
  await prisma.executionInstance.deleteMany();
  await prisma.project.deleteMany();

  // Load production projects from JSON files
  const proforientacija = await loadProjectFromFile("proforientacija.json");
  const psychodiagnostika = await loadProjectFromFile("psychodiagnostika.json");

  // Create Профориентация project
  const profProject = await prisma.project.create({
    data: {
      id: proforientacija.id,
      name: proforientacija.name,
      description:
        proforientacija.description ||
        "Пайплайн профессиональной ориентации (CAREER_GUIDANCE)",
      isSystem: true,
      canvasData: proforientacija.canvasData,
      globalVariables: {
        create: proforientacija.globalVariables.map((gv) => ({
          name: gv.name,
          value: gv.value || "",
          description: gv.description,
        })),
      },
    },
  });

  const profVarsCount = await prisma.globalVariable.count({
    where: { projectId: profProject.id },
  });
  console.log(
    `✅ Created project: ${profProject.name} with ${profVarsCount} variables`,
  );

  // Create Психодиагностика project
  const psychoProject = await prisma.project.create({
    data: {
      id: psychodiagnostika.id,
      name: psychodiagnostika.name,
      description:
        psychodiagnostika.description ||
        "Пайплайн психодиагностики (PSYCHODIAGNOSTICS)",
      isSystem: true,
      canvasData: psychodiagnostika.canvasData,
      globalVariables: {
        create: psychodiagnostika.globalVariables.map((gv) => ({
          name: gv.name,
          value: gv.value || "",
          description: gv.description,
        })),
      },
    },
  });

  const psychoVarsCount = await prisma.globalVariable.count({
    where: { projectId: psychoProject.id },
  });
  console.log(
    `✅ Created project: ${psychoProject.name} with ${psychoVarsCount} variables`,
  );

  console.log("🎉 Database seeding completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`   - Профориентация: ${profVarsCount} variables`);
  console.log(`   - Психодиагностика: ${psychoVarsCount} variables`);
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
