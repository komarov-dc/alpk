/**
 * Скрипт для создания 3 тестовых пользователей
 * Использование: npx ts-node scripts/create-test-users.ts
 */

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_USERS = [
  {
    email: 'test.user1@example.com',
    password: 'TestPass123!',
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: 'Петрович',
    phone: '+7 (999) 111-11-11',
    birthDate: new Date('2000-01-15'),
    role: UserRole.USER,
    status: UserStatus.STUDENT,
  },
  {
    email: 'test.user2@example.com',
    password: 'TestPass123!',
    firstName: 'Мария',
    lastName: 'Петрова',
    middleName: 'Сергеевна',
    phone: '+7 (999) 222-22-22',
    birthDate: new Date('1999-05-20'),
    role: UserRole.USER,
    status: UserStatus.STUDENT,
  },
  {
    email: 'test.user3@example.com',
    password: 'TestPass123!',
    firstName: 'Алексей',
    lastName: 'Сидоров',
    middleName: 'Александрович',
    phone: '+7 (999) 333-33-33',
    birthDate: new Date('2001-11-30'),
    role: UserRole.USER,
    status: UserStatus.STUDENT,
  },
];

async function createTestUsers() {
  console.log('🚀 Начинаем создание тестовых пользователей...\n');

  try {
    for (const userData of TEST_USERS) {
      // Проверяем, существует ли уже пользователь
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`⚠️  Пользователь ${userData.email} уже существует, пропускаем...`);
        continue;
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Создаем пользователя
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
      });

      console.log(`✅ Создан пользователь:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Пароль: ${userData.password}`);
      console.log(`   Имя: ${user.firstName} ${user.lastName}`);
      console.log(`   ID: ${user.id}\n`);
    }

    console.log('✨ Все тестовые пользователи созданы успешно!\n');
    console.log('📋 Данные для входа:');
    console.log('━'.repeat(60));
    TEST_USERS.forEach((user, index) => {
      console.log(`\nПользователь ${index + 1}:`);
      console.log(`  Email:    ${user.email}`);
      console.log(`  Пароль:   ${user.password}`);
      console.log(`  Имя:      ${user.firstName} ${user.lastName}`);
    });
    console.log('\n' + '━'.repeat(60));

  } catch (error) {
    console.error('❌ Ошибка при создании пользователей:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Функция для удаления тестовых пользователей (если нужно)
async function deleteTestUsers() {
  console.log('🗑️  Удаляем тестовых пользователей...\n');

  try {
    const emails = TEST_USERS.map(u => u.email);

    const result = await prisma.user.deleteMany({
      where: {
        email: {
          in: emails,
        },
      },
    });

    console.log(`✅ Удалено ${result.count} тестовых пользователей`);
  } catch (error) {
    console.error('❌ Ошибка при удалении пользователей:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Главная функция
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--delete')) {
    await deleteTestUsers();
  } else {
    await createTestUsers();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
