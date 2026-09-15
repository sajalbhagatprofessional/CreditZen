import { CreditCard, NotificationSettings } from '../types';
import { differenceInDays, addMonths, setDate, startOfDay, isBefore, format, parseISO } from 'date-fns';

export interface UrgentAlert {
  id: string;
  type: 'due' | 'statement' | 'benefit';
  cardName: string;
  issuer: string;
  daysRemaining: number;
  message: string;
  targetDate: Date;
  actionUrl?: string;
}

const LAST_NOTIFIED_KEY = 'creditzen_last_notification_date';

/**
 * Checks if the Notification API is supported by the current browser.
 */
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Gets the current notification permission status.
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

/**
 * Requests permission from the user to display notifications.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return 'denied';
  }
};

/**
 * Calculates the next occurrence of a specific day of the month.
 */
export const getNextDayOccurrence = (day?: number): Date | null => {
  if (!day || day < 1 || day > 31) return null;
  const today = startOfDay(new Date());
  let target = setDate(today, Math.min(day, 28)); // Safe day handling
  if (isBefore(target, today)) {
    target = addMonths(target, 1);
  }
  return target;
};

/**
 * Scans all cards and evaluates urgent alerts based on user settings.
 */
export const evaluateCardAlerts = (
  cards: CreditCard[], 
  settings: NotificationSettings
): UrgentAlert[] => {
  const alerts: UrgentAlert[] = [];
  const today = startOfDay(new Date());
  const daysDueThreshold = settings.daysBeforeDue ?? 3;
  const daysStmtThreshold = settings.daysBeforeStatement ?? 2;

  for (const card of cards) {
    if (card.type !== 'Credit') continue;

    // 1. Check Payment Due Date
    if (card.dueDay) {
      const nextDue = getNextDayOccurrence(card.dueDay);
      if (nextDue) {
        const diff = differenceInDays(nextDue, today);
        if (diff >= 0 && diff <= daysDueThreshold) {
          alerts.push({
            id: `${card.id}-due-${format(nextDue, 'yyyy-MM-dd')}`,
            type: 'due',
            cardName: card.name || card.issuer,
            issuer: card.issuer,
            daysRemaining: diff,
            targetDate: nextDue,
            message: diff === 0 
              ? `Payment is DUE TODAY on ${card.issuer}!` 
              : `Payment due in ${diff} day${diff > 1 ? 's' : ''} on ${card.issuer} (${format(nextDue, 'MMM d')}).`,
            actionUrl: card.paymentUrl
          });
        }
      }
    }

    // 2. Check Statement Closing Date
    if (card.statementDay) {
      const nextStmt = getNextDayOccurrence(card.statementDay);
      if (nextStmt) {
        const diff = differenceInDays(nextStmt, today);
        if (diff >= 0 && diff <= daysStmtThreshold) {
          alerts.push({
            id: `${card.id}-stmt-${format(nextStmt, 'yyyy-MM-dd')}`,
            type: 'statement',
            cardName: card.name || card.issuer,
            issuer: card.issuer,
            daysRemaining: diff,
            targetDate: nextStmt,
            message: diff === 0
              ? `Statement closes TODAY on ${card.issuer}. Pay balance to optimize reporting!`
              : `Statement closes in ${diff} day${diff > 1 ? 's' : ''} on ${card.issuer} (${format(nextStmt, 'MMM d')}).`,
            actionUrl: card.paymentUrl
          });
        }
      }
    }

    // 3. Check Expiring Temporary Benefits
    if (card.temporaryBenefits && card.temporaryBenefits.length > 0) {
      for (const benefit of card.temporaryBenefits) {
        if (!benefit.expiryDate) continue;
        try {
          const expiry = parseISO(benefit.expiryDate);
          const diff = differenceInDays(expiry, today);
          if (diff >= 0 && diff <= 7) {
            alerts.push({
              id: `${card.id}-benefit-${benefit.category}-${benefit.expiryDate}`,
              type: 'benefit',
              cardName: card.name || card.issuer,
              issuer: card.issuer,
              daysRemaining: diff,
              targetDate: expiry,
              message: `${benefit.category} ${benefit.multiplier}x bonus on ${card.issuer} expires in ${diff} day${diff > 1 ? 's' : ''}!`
            });
          }
        } catch (e) {
          // ignore invalid date
        }
      }
    }
  }

  // Sort alerts by urgency (closest first)
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
};

/**
 * Dispatches a native or Service Worker notification.
 */
export const dispatchNotification = async (
  title: string, 
  body: string, 
  tag?: string,
  url?: string
): Promise<boolean> => {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: tag || 'creditzen-reminder',
    data: { url: url || '/' },
    vibrate: [100, 50, 100],
    silent: false
  } as any;

  try {
    // Prefer Service Worker showNotification for persistent native notifications
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, options);
        return true;
      }
    }

    // Fallback to standard window Notification
    new Notification(title, options);
    return true;
  } catch (e) {
    console.warn('Notification dispatch fallback error:', e);
    try {
      new Notification(title, options);
      return true;
    } catch (err) {
      return false;
    }
  }
};

/**
 * Checks for urgent deadlines and sends notifications once per day.
 */
export const processDailyReminders = async (
  cards: CreditCard[], 
  settings: NotificationSettings
) => {
  if (getNotificationPermission() !== 'granted') return;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);

  // If already notified today, do not spam user
  if (lastNotified === todayStr) return;

  const alerts = evaluateCardAlerts(cards, settings);
  if (alerts.length === 0) return;

  // Send top urgent alert
  const topAlert = alerts[0];
  const title = topAlert.type === 'due' 
    ? `⚠️ Payment Due Alert` 
    : topAlert.type === 'statement' 
    ? `📊 Statement Closing Soon` 
    : `🎁 Expiring Credit Card Perk`;

  const sent = await dispatchNotification(title, topAlert.message, topAlert.id, topAlert.actionUrl);
  if (sent) {
    localStorage.setItem(LAST_NOTIFIED_KEY, todayStr);
  }
};

/**
 * Trigger a test notification immediately so the user can verify on their device.
 */
export const sendTestNotification = async (): Promise<boolean> => {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') {
    throw new Error('Notification permission was denied. Please allow notifications in your browser settings.');
  }

  return await dispatchNotification(
    '💳 CreditZen Active',
    'Your notifications are properly configured! You will receive due date and statement alerts on this device.',
    'creditzen-test'
  );
};
