/**
 * 🔔 Bildirishnomalar handler
 */
import { BotContext } from '../bot';
import { getUserByChatId, getNotifications, getUnreadNotificationCount } from '../services/data.service';
import { backToMenu } from '../utils/keyboards';
import { formatDate, escapeHtml, notificationEmoji, brandHeader, brandFooter } from '../utils/format';

export async function handleNotifications(ctx: BotContext) {
  try {
    const chatId = String(ctx.chat?.id);
    const user = await getUserByChatId(chatId);

    if (!user) {
      await ctx.editMessageText('❌ Foydalanuvchi topilmadi.', { reply_markup: backToMenu() });
      return;
    }

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id, 15),
      getUnreadNotificationCount(user.id),
    ]);

    let text = brandHeader('🔔', 'BILDIRISHNOMALAR');

    if (unreadCount > 0) {
      text += `🔴 <b>${unreadCount} ta</b> o'qilmagan xabar\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    if (notifications.length === 0) {
      text += '📭 Bildirishnomalar yo\'q.';
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: backToMenu() });
      return;
    }

    for (const n of notifications) {
      const emoji = notificationEmoji(n.type || '');
      const date = formatDate(n.createdAt);
      const unread = !n.isRead ? '🔵 ' : '';

      text += `${unread}${emoji} <b>${escapeHtml(n.title)}</b>\n`;
      if (n.body) {
        const msg = n.body.length > 100 ? n.body.slice(0, 100) + '...' : n.body;
        text += `   ${escapeHtml(msg)}\n`;
      }
      text += `   <i>${date}</i>\n\n`;
    }

    text += brandFooter();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: backToMenu(),
    });
  } catch (err) {
    console.error('❌ handleNotifications xatosi:', err);
    await ctx.editMessageText('❌ Xatolik yuz berdi.', { reply_markup: backToMenu() }).catch(() => {});
  }
}
