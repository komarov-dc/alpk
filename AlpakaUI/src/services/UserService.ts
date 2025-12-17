import { prisma } from '@/lib/prisma';
import { User, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Backend Service для работы с пользователями
 * Используется в API routes (server-side)
 */
export class UserService {
  /**
   * Получить список пользователей с фильтром
   */
  static async listUsers(filter: Prisma.UserWhereInput = {}): Promise<User[]> {
    return prisma.user.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Создать пользователя
   */
  static async createUser(
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      phone: string;
      birthDate: Date;
      role?: UserRole;
    },
    _createdBy: string,
    _ipAddress?: string | null
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        phone: data.phone,
        birthDate: data.birthDate,
        role: data.role || 'USER',
      },
    });
  }

  /**
   * Получить пользователя по ID
   */
  static async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Обновить роль пользователя
   */
  static async updateUserRole(id: string, role: UserRole): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  /**
   * Удалить пользователя
   */
  static async deleteUser(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }
}
