import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { UserRole, ReportType, ReportVisibility } from '@prisma/client';
import { logger } from '@/utils/logger';
import { normalizeError } from '@/utils/normalizeError';
import {
  generateSimplifiedReport,
  generateAnalyticalReport,
  generateQuantitativeReport,
  type SimplifiedReport,
  type AnalyticalReport,
  type QuantitativeReport,
} from '@/lib/reports/generator';

const CreateReportSchema = z.object({
  sessionId: z.string(),
  type: z.enum(['SIMPLIFIED', 'ANALYTICAL', 'QUANTITATIVE']),
});

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole;

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreateReportSchema.parse(body);

    // Fetch session with responses
    const session = await prisma.session.findUnique({
      where: { id: validatedData.sessionId },
      include: {
        responses: true,
        user: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check permissions
    const isOwner = session.userId === userId;
    const canCreateReport = hasPermission(userRole, 'reports.create') || isOwner;

    if (!canCreateReport) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate report content based on type
    let reportContent: SimplifiedReport | AnalyticalReport | QuantitativeReport;
    let visibility: ReportVisibility = ReportVisibility.PRIVATE;

    switch (validatedData.type) {
      case 'SIMPLIFIED':
        reportContent = generateSimplifiedReport(session);
        visibility = ReportVisibility.PRIVATE;
        break;
      case 'ANALYTICAL':
        if (!hasPermission(userRole, 'reports.viewAll') && !isOwner) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        reportContent = generateAnalyticalReport(session);
        visibility = ReportVisibility.RESTRICTED;
        break;
      case 'QUANTITATIVE':
        if (!hasPermission(userRole, 'reports.viewAll') && !isOwner) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        reportContent = generateQuantitativeReport(session);
        visibility = ReportVisibility.RESTRICTED;
        break;
    }

    // Save report to database
    const report = await prisma.report.create({
      data: {
        sessionId: session.id,
        userId: session.userId,
        type: validatedData.type as ReportType,
        content: JSON.stringify(reportContent),
        visibility,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'REPORT_CREATED',
        entityType: 'Report',
        entityId: report.id,
        metadata: JSON.stringify({
          sessionId: session.id,
          reportType: validatedData.type,
          timestamp: new Date(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      id: report.id,
      type: report.type,
      content: reportContent,
      createdAt: report.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    // Error creating report
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as UserRole;

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const reportId = searchParams.get('id');

    if (reportId) {
      // Fetch specific report
      const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: {
          session: true,
          user: true,
        },
      });

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      // Check access permissions
      const isOwner = report.userId === userId;
      const isAdmin = userRole === UserRole.ADMIN;
      const isConsultantOfClient = userRole === UserRole.CONSULTANT && 
        report.user && report.user.consultantId === userId;

      if (!isOwner && !isAdmin && !isConsultantOfClient) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({
        id: report.id,
        type: report.type,
        content: JSON.parse(report.content),
        sessionId: report.sessionId,
        createdAt: report.createdAt,
      });
    }

    // Fetch reports based on role permissions
    const whereClause: Record<string, unknown> = {};

    if (userRole === UserRole.ADMIN) {
      // Admin can view all reports
      if (sessionId) {
        whereClause.sessionId = sessionId;
      }
    } else if (userRole === UserRole.CONSULTANT) {
      // Consultant can view their own reports and their clients' reports
      whereClause.OR = [
        { userId: userId },
        { user: { consultantId: userId } },
      ];
      if (sessionId) {
        whereClause.sessionId = sessionId;
      }
    } else {
      // Users can only view their own reports
      whereClause.userId = userId;
      if (sessionId) {
        whereClause.sessionId = sessionId;
      }
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      include: {
        session: {
          select: {
            id: true,
            mode: true,
            status: true,
            completedAt: true,
            startedAt: true,
            user: {
              select: {
                id: true,
                email: true,
                lastName: true,
                firstName: true,
                middleName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      reports.map(report => ({
        id: report.id,
        type: report.type,
        sessionId: report.sessionId,
        session: report.session,
        createdAt: report.createdAt,
      }))
    );
  } catch (error) {
    logger.error('Error fetching reports:', normalizeError(error));
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}