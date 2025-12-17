import {
  PrismaClient,
  SessionMode,
  UserRole,
  UserStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import {
  psychodiagnosticsQuestions,
  careerGuidanceQuestions,
} from "../src/data/questions";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.response.deleteMany();
  await prisma.session.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
  await prisma.question.deleteMany();
  await prisma.settings.deleteMany();

  // Create single admin user with admin/admin credentials
  const adminPassword = await bcrypt.hash("admin", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@psypro.local",
      password: adminPassword,
      lastName: "Администратор",
      firstName: "Системный",
      phone: "+7 (000) 000-00-00",
      birthDate: new Date("1980-01-01"),
      status: UserStatus.EMPLOYEE,
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  });

  console.log("✅ Created admin user:", admin.email);

  // Create 3 test users
  const testPassword = await bcrypt.hash("TestPass123!", 10);

  const user1 = await prisma.user.create({
    data: {
      email: "test.user1@example.com",
      password: testPassword,
      lastName: "Иванов",
      firstName: "Иван",
      middleName: "Петрович",
      phone: "+7 (999) 111-11-11",
      birthDate: new Date("2000-01-15"),
      status: UserStatus.STUDENT,
      role: UserRole.USER,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "test.user2@example.com",
      password: testPassword,
      lastName: "Петрова",
      firstName: "Мария",
      middleName: "Сергеевна",
      phone: "+7 (999) 222-22-22",
      birthDate: new Date("1999-05-20"),
      status: UserStatus.STUDENT,
      role: UserRole.USER,
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: "test.user3@example.com",
      password: testPassword,
      lastName: "Сидоров",
      firstName: "Алексей",
      middleName: "Александрович",
      phone: "+7 (999) 333-33-33",
      birthDate: new Date("2001-11-30"),
      status: UserStatus.STUDENT,
      role: UserRole.USER,
    },
  });

  console.log("✅ Created test users:", [
    user1.email,
    user2.email,
    user3.email,
  ]);

  // Create questions for psychodiagnostics from the correct source
  for (let i = 0; i < psychodiagnosticsQuestions.length; i++) {
    await prisma.question.create({
      data: {
        mode: SessionMode.PSYCHODIAGNOSTICS,
        text: psychodiagnosticsQuestions[i]!,
        orderIndex: i,
        active: true,
      },
    });
  }

  // Create questions for career guidance from the correct source
  for (let i = 0; i < careerGuidanceQuestions.length; i++) {
    await prisma.question.create({
      data: {
        mode: SessionMode.CAREER_GUIDANCE,
        text: careerGuidanceQuestions[i]!,
        orderIndex: i,
        active: true,
      },
    });
  }

  console.log("✅ Created questions:", {
    psychodiagnostics: psychodiagnosticsQuestions.length,
    careerGuidance: careerGuidanceQuestions.length,
  });

  // Create sample session for the admin
  const session = await prisma.session.create({
    data: {
      userId: admin.id,
      mode: SessionMode.PSYCHODIAGNOSTICS,
      status: "COMPLETED",
      totalQuestions: 5,
      currentIndex: 5,
      analysis: JSON.stringify({
        overallScore: 75,
        stressLevel: "medium",
        emotionalState: "stable",
        recommendations: [
          "Regular mindfulness practice",
          "Maintain work-life balance",
        ],
      }),
      summary:
        "Общее эмоциональное состояние стабильное, рекомендуется продолжать работу над управлением стрессом.",
      startedAt: new Date("2024-12-01T10:00:00"),
      completedAt: new Date("2024-12-01T10:45:00"),
    },
  });

  // Create sample responses
  for (let i = 0; i < 5; i++) {
    await prisma.response.create({
      data: {
        sessionId: session.id,
        questionId: i + 1,
        questionText: psychodiagnosticsQuestions[i]!,
        answer: `Это мой ответ на вопрос ${i + 1}. Я думаю, что...`,
        timeSpent: Math.floor(Math.random() * 120) + 30,
        tokenCount: Math.floor(Math.random() * 50) + 20,
        charCount: Math.floor(Math.random() * 200) + 100,
      },
    });
  }

  console.log("✅ Created sample session with responses");

  // Create sample reports
  await prisma.report.create({
    data: {
      sessionId: session.id,
      userId: admin.id,
      type: "ADAPTED",
      visibility: "PRIVATE",
      content: JSON.stringify({
        title: "Результаты психологической диагностики",
        summary: "Ваше эмоциональное состояние в норме",
        recommendations: [
          "Продолжайте практиковать медитацию",
          "Уделяйте время отдыху",
        ],
      }),
    },
  });

  await prisma.report.create({
    data: {
      sessionId: session.id,
      userId: admin.id,
      type: "FULL",
      visibility: "RESTRICTED",
      content: JSON.stringify({
        title: "Полный отчет",
        psychProfile: {
          anxiety: 4.2,
          depression: 2.1,
          stress: 5.5,
          adaptation: 7.8,
        },
        detailedAnalysis: "Detailed psychological analysis...",
      }),
    },
  });

  await prisma.report.create({
    data: {
      sessionId: session.id,
      userId: admin.id,
      type: "SCORE_TABLE",
      visibility: "RESTRICTED",
      content: JSON.stringify({
        title: "Бальная таблица",
        scores: {
          emotionalStability: 82,
          socialAdaptation: 75,
          selfEsteem: 68,
          motivation: 85,
          stressResistance: 72,
        },
      }),
    },
  });

  console.log("✅ Created sample reports");

  // Create app settings
  await prisma.settings.create({
    data: {
      key: "app_name",
      value: JSON.stringify({ value: "Psy&Pro UI", type: "string" }),
    },
  });

  await prisma.settings.create({
    data: {
      key: "maintenance_mode",
      value: JSON.stringify({ value: false, type: "boolean" }),
    },
  });

  await prisma.settings.create({
    data: {
      key: "session_timeout",
      value: JSON.stringify({
        value: 3600000,
        type: "number",
        unit: "milliseconds",
      }),
    },
  });

  console.log("✅ Created app settings");

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED_DATABASE",
      entityType: "System",
      metadata: JSON.stringify({
        message: "Database seeded with test data",
        timestamp: new Date(),
      }),
      ipAddress: "127.0.0.1",
      userAgent: "Prisma Seed Script",
    },
  });

  console.log("✅ Created audit log entry");
  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📝 Admin credentials:");
  console.log("Email: admin");
  console.log("Password: admin");
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
