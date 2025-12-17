import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { buildUserFilter } from "@/lib/auth/dataFilters";
import { UserService } from "@/services/UserService";
import { handleApiError } from "@/lib/errors/ApiError";
import { hasPermission } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    // Get user info from headers (set by middleware)
    const userRole = request.headers.get("x-user-role") as UserRole;
    const userId = request.headers.get("x-user-id");

    if (!userRole || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (!hasPermission(userRole, "users.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build filter based on user role
    const roleFilter = buildUserFilter(userRole, userId);

    // Fetch users using UserService
    const users = await UserService.listUsers(roleFilter);

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error, "UserAPI.GET");
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get("x-user-role") as UserRole;
    const currentUserId = request.headers.get("x-user-id");

    // Only admins can create users through this endpoint
    if (userRole !== "ADMIN" || !currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");

    // Convert birthDate string to Date object if provided
    if (body.birthDate && typeof body.birthDate === "string") {
      body.birthDate = new Date(body.birthDate);
    }

    // Use UserService to create user (handles validation, hashing, audit logging)
    const user = await UserService.createUser(body, currentUserId, ipAddress);

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, "UserAPI.POST");
  }
}
