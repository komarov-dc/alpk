/**
 * HTML шаблоны для email
 */

export interface WelcomeEmailData {
  userName: string;
}

export function getWelcomeEmailHtml(data: WelcomeEmailData): string {
  const { userName } = data;

  return `
    <!DOCTYPE html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Добро пожаловать в BackendUI</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 48px 20px;">
                    <h1 style="margin: 0; color: #333; font-size: 24px; font-weight: bold;">
                      Добро пожаловать, ${userName}!
                    </h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 0 48px 24px;">
                    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 26px;">
                      Спасибо за регистрацию в нашей платформе. Мы рады видеть вас среди наших пользователей.
                    </p>

                    <p style="margin: 0 0 16px; color: #333; font-size: 16px; line-height: 26px;">
                      Теперь вы можете:
                    </p>

                    <ul style="margin: 0 0 24px; padding-left: 20px; color: #333; font-size: 16px; line-height: 26px;">
                      <li>Создавать и управлять сессиями</li>
                      <li>Общаться с клиентами через чат</li>
                      <li>Просматривать отчеты и статистику</li>
                      <li>И многое другое!</li>
                    </ul>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 48px;">
                    <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 20px 0;">
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 48px 40px;">
                    <p style="margin: 0; color: #8898aa; font-size: 12px; line-height: 16px;">
                      Если у вас есть вопросы, не стесняйтесь обращаться к нам.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function getWelcomeEmailText(data: WelcomeEmailData): string {
  const { userName } = data;

  return `
Добро пожаловать, ${userName}!

Спасибо за регистрацию в нашей платформе. Мы рады видеть вас среди наших пользователей.

Теперь вы можете:
- Создавать и управлять сессиями
- Общаться с клиентами через чат
- Просматривать отчеты и статистику
- И многое другое!

Если у вас есть вопросы, не стесняйтесь обращаться к нам.
  `.trim();
}
