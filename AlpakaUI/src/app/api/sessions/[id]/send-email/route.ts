import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/resend";
import { generateReportPDF } from "@/lib/pdf/generator";
import { htmlToText } from "html-to-text";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";

// Clean markdown formatting from text
const cleanMarkdown = (text: string): string => {
  // Replace escaped newlines with actual newlines
  let cleaned = text.replace(/\\n/g, "\n");

  // Remove markdown headers but keep the text
  cleaned = cleaned.replace(/^#+\s*/gm, "");

  // Remove bold/italic markdown
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");

  // Remove bullet points markdown, replace with actual bullets
  cleaned = cleaned.replace(/^[-*]\s+/gm, "• ");

  // Clean up multiple consecutive newlines (max 2)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
};

// Extract plain text from report content (same logic as client-side)
const extractPlainText = (
  content: string,
  type: "FULL" | "ADAPTED" | "SCORE_TABLE",
): string => {
  try {
    const jsonContent = JSON.parse(content);

    let text = "";

    if (type === "ADAPTED" && jsonContent.adapted_report?.full_text) {
      text = jsonContent.adapted_report.full_text;
    } else if (
      type === "FULL" &&
      jsonContent.final_professional_report?.full_text
    ) {
      text = jsonContent.final_professional_report.full_text;
    } else if (type === "SCORE_TABLE" && jsonContent.aggregate_score_profile) {
      return JSON.stringify(jsonContent.aggregate_score_profile, null, 2);
    } else {
      text = JSON.stringify(jsonContent, null, 2);
    }

    // Clean markdown formatting
    return cleanMarkdown(text);
  } catch {
    // If not JSON, treat as HTML and convert
    const text = htmlToText(content, {
      wordwrap: 100,
      preserveNewlines: true,
    });
    return cleanMarkdown(text);
  }
};

const generatePDFBuffer = async (options: {
  title: string;
  content: string;
  reportType: "FULL" | "ADAPTED" | "SCORE_TABLE";
  respondentName?: string;
  date: string;
}): Promise<Buffer> => {
  // Extract plain text from report content
  const plainText = extractPlainText(options.content, options.reportType);

  // Use the same PDF generator as the client-side (with Roboto font support)
  const blob = generateReportPDF({
    ...options,
    content: plainText,
  });

  // Convert Blob to ArrayBuffer then to Buffer for Node.js
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const sessionId = resolvedParams.id;

    const body = await request.json();
    const { email } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 },
      );
    }

    // Get session with reports
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
        },
        responses: {
          orderBy: { questionId: "asc" },
        },
        user: {
          select: {
            id: true,
            lastName: true,
            firstName: true,
            middleName: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.reports.length === 0) {
      return NextResponse.json(
        { error: "No reports available for this session" },
        { status: 400 },
      );
    }

    // Generate respondent name from user data
    const respondentName = session.user
      ? `${session.user.lastName} ${session.user.firstName}${session.user.middleName ? " " + session.user.middleName : ""}`
      : "report";

    // Filter reports based on user role
    // USER: only ADAPTED
    // CONSULTANT/ADMIN: ADAPTED and FULL (no SCORE_TABLE)
    const allowedReports = session.reports.filter((report) => {
      if (report.type === "SCORE_TABLE") return false;
      if (userRole === "USER" && report.type === "FULL") return false;
      return true;
    });

    // Generate PDFs and TXTs for allowed reports
    const attachments = await Promise.all(
      allowedReports.flatMap(async (report) => {
        const typeNames = {
          FULL: "Full_Report",
          ADAPTED: "Adapted_Report",
          SCORE_TABLE: "Score_Table",
        };

        const typeTitles = {
          FULL: "Полный отчет",
          ADAPTED: "Адаптированный отчет",
          SCORE_TABLE: "Score Table",
        };

        const typeTitlesEn = {
          FULL: "Full Report",
          ADAPTED: "Adapted Report",
          SCORE_TABLE: "Score Table",
        };

        // Extract and clean plain text
        const plainText = extractPlainText(report.content, report.type);

        // Generate PDF
        const pdfBuffer = await generatePDFBuffer({
          title: typeTitlesEn[report.type],
          content: report.content,
          reportType: report.type,
          respondentName,
          date: new Date().toLocaleDateString("ru-RU"),
        });

        // Create TXT header
        const txtHeader = `
═══════════════════════════════════════════════════════
${typeTitles[report.type]}
═══════════════════════════════════════════════════════

Респондент: ${respondentName}
Дата: ${new Date().toLocaleDateString("ru-RU")}
Сессия: ${session.id}

═══════════════════════════════════════════════════════

`;

        const txtContent = txtHeader + plainText;
        const txtBuffer = Buffer.from(txtContent, "utf-8");

        return [
          {
            filename: `${typeNames[report.type]}_${respondentName}.pdf`,
            content: pdfBuffer,
          },
          {
            filename: `${typeNames[report.type]}_${respondentName}.txt`,
            content: txtBuffer,
          },
        ];
      }),
    ).then((arrays) => arrays.flat());

    // Create email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f7fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #718096; font-size: 12px; }
            .button { background: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Psy&Pro UI</h1>
              <p>Ваши отчёты готовы</p>
            </div>
            <div class="content">
              <h2>Здравствуйте, ${respondentName}!</h2>
              <p>Ваши психологические отчёты готовы и прикреплены к этому письму.</p>

              <h3>Информация о сессии:</h3>
              <ul>
                <li>Дата прохождения: ${new Date(session.completedAt || session.startedAt).toLocaleDateString("ru-RU")}</li>
                <li>Количество вопросов: ${session.totalQuestions}</li>
              </ul>

              <h3>Прикреплённые файлы:</h3>
              <p>К письму прикреплены результаты тестирования в двух форматах:</p>
              <ul>
                <li><strong>PDF</strong> - для удобного просмотра и печати</li>
                <li><strong>TXT</strong> - текстовая версия</li>
              </ul>

              <p>Результаты содержат детальный анализ Ваших ответов и персональные рекомендации.</p>

              <p><strong>Обратите внимание:</strong> Отчёты являются конфиденциальными. Не передавайте их третьим лицам без необходимости.</p>
            </div>
            <div class="footer">
              <p>Это письмо было отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
              <p>&copy; ${new Date().getFullYear()} Psy&Pro UI. Все права защищены.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const result = await sendEmail({
      to: email,
      subject: `Отчёты по психологической диагностике - ${respondentName}`,
      html: emailHtml,
      attachments,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Reports sent successfully",
      });
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 },
      );
    }
  } catch (error) {
    logger.error("Failed to send reports via email", normalizeError(error));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
