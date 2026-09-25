// Background service worker for ApplyOS.
//
// Responsibilities, in order of importance:
//   1. Own the reminder schedule (chrome.alarms) and deliver notifications.
//   2. Route messages between the popup and content scripts.
//   3. Keep the toolbar badge showing how many follow-ups are due.
//
// The reminder code is the reason the `alarms` and `notifications` permissions
// are declared. See PERMISSIONS.md — scripts/audit-permissions.mjs fails the
// build if either API call disappears.

import {
    countInFlightApplications,
    fetchInFlightApplications,
    getStoredSession,
} from '../lib/api/rest'
import { dueReminders, toCandidates, type ReminderDecision } from '../lib/reminders/reminder-engine'
import { captureJobFromCommand, fillFieldFromContextMenu, fillFormFromCommand, proxyAiAnswer } from './actions'

/**
 * A service worker is torn down constantly, so this is only a fast path to stop
 * a second alarm firing during an in-flight run. Durable state lives in
 * chrome.storage — never in these variables.
 */
const notifiedThisSession = new Set<string>()

const REMINDER_ALARM = 'applyos:reminder-sweep'
/** Chrome enforces a 30s floor on alarm periods; an hourly sweep is plenty. */
const SWEEP_PERIOD_MINUTES = 60
const STORAGE_NOTIFIED = 'reminderHistory'
const STORAGE_SETTINGS = 'settings'
const BADGE_COLOR = '#18bb70'

export interface ExtensionSettings {
    enabledPlatforms: string[]
    autoDetect: boolean
    /** Follow-up reminders. Replaces the 1.0.0 `notifications` flag that was never wired up. */
    followUpReminders: boolean
    staleReminders: boolean
    followUpAfterDays: number
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
    enabledPlatforms: ['linkedin', 'indeed', 'workday', 'greenhouse', 'lever', 'glassdoor', 'ashby', 'smartrecruiters'],
    autoDetect: true,
    followUpReminders: true,
    staleReminders: true,
    followUpAfterDays: 7,
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function getSettings(): Promise<ExtensionSettings> {
    const stored = await chrome.storage.local.get([STORAGE_SETTINGS])
    return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_SETTINGS] ?? {}) }
}

// ---------------------------------------------------------------------------
// Reminder sweep
// ---------------------------------------------------------------------------

interface ReminderHistory {
    /** notificationId -> ISO timestamp it was last shown. */
    [notificationId: string]: string
}

async function getHistory(): Promise<ReminderHistory> {
    const stored = await chrome.storage.local.get([STORAGE_NOTIFIED])
    return (stored[STORAGE_NOTIFIED] as ReminderHistory) ?? {}
}

async function showReminder(decision: ReminderDecision): Promise<void> {
    await chrome.notifications.create(decision.notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: decision.title,
        message: decision.message,
        // Tagging the application id means a click can deep-link straight to it.
        contextMessage: 'ApplyOS',
        priority: decision.kind === 'stale' ? 1 : 0,
        buttons: [{ title: 'Open application' }, { title: 'Snooze 7 days' }],
    })
}

async function runReminderSweep(trigger: 'alarm' | 'manual' = 'alarm'): Promise<{ shown: number; skipped: string | null }> {
    const settings = await getSettings()

    if (!settings.followUpReminders && !settings.staleReminders) {
        return { shown: 0, skipped: 'reminders disabled' }
    }

    // No stored session means no data to read and nothing to notify about.
    // Bailing here also avoids a pointless request every hour for signed-out users.
    const session = await getStoredSession()
    if (!session?.access_token) {
        await updateBadge(0)
        return { shown: 0, skipped: 'signed out' }
    }

    const rows = await fetchInFlightApplications(settings.followUpAfterDays)
    if (rows === null) {
        // Covers offline, a stale token, or a rejected request. None of these
        // warrant a notification, and the next sweep retries.
        return { shown: 0, skipped: 'no data' }
    }

    const history = await getHistory()
    const decisions = dueReminders(toCandidates(rows), new Date(), {
        followUpAfterDays: settings.followUpAfterDays,
        alreadySent: notifiedThisSession,
    }).filter((decision) => {
        if (decision.kind === 'stale' && !settings.staleReminders) return false
        if (decision.kind === 'follow_up' && !settings.followUpReminders) return false
        // A notification already shown for this application stays shown; the
        // history check is what makes reminders once-per-threshold rather than
        // once-per-hour.
        return !history[decision.notificationId]
    })

    for (const decision of decisions) {
        await showReminder(decision)
        history[decision.notificationId] = new Date().toISOString()
        notifiedThisSession.add(decision.notificationId)
    }

    if (decisions.length > 0) {
        await chrome.storage.local.set({ [STORAGE_NOTIFIED]: history })
    }

    await updateBadge(decisions.length)

    console.log(
        `[ApplyOS] reminder sweep (${trigger}): ${decisions.length} shown, ${rows.length} candidate(s) considered`
    )
    return { shown: decisions.length, skipped: null }
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

async function updateBadge(count: number): Promise<void> {
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
    if (count > 0) {
        await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR })
    }
}

/**
 * Count applications currently in flight, for the badge shown when no reminder
 * is pending.
 */
async function refreshBadgeFromApplications(): Promise<void> {
    const count = await countInFlightApplications()
    if (count === null) return
    await updateBadge(count)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function scheduleReminderSweep(): Promise<void> {
    const existing = await chrome.alarms.get(REMINDER_ALARM)
    if (existing) return

    await chrome.alarms.create(REMINDER_ALARM, {
        // First run shortly after install/browser start so a returning user sees
        // value immediately, then hourly.
        delayInMinutes: 1,
        periodInMinutes: SWEEP_PERIOD_MINUTES,
    })
}

chrome.runtime.onInstalled.addListener((details) => {
    void (async () => {
        if (details.reason === 'install') {
            await chrome.storage.local.set({ [STORAGE_SETTINGS]: DEFAULT_SETTINGS })
        }
        await scheduleReminderSweep()
        await registerContextMenus()
        if (details.reason === 'install') {
            await refreshBadgeFromApplications()
        }
    })()
})

// Alarms survive restarts, but the handler must be re-registered each time the
// worker spins up, so this listener is registered at the top level.
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== REMINDER_ALARM) return
    void runReminderSweep('alarm')
})

// Re-arm if the browser dropped the alarm (e.g. after an update).
chrome.runtime.onStartup.addListener(() => {
    void scheduleReminderSweep()
    void registerContextMenus()
})

chrome.notifications.onClicked.addListener((notificationId) => {
    void openApplicationFromNotification(notificationId)
})

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    void (async () => {
        if (buttonIndex === 0) {
            await openApplicationFromNotification(notificationId)
            return
        }
        // Snooze: record a future timestamp so the reminder is suppressed for a
        // week without losing the fact that it was sent.
        const history = await getHistory()
        const snoozedUntil = new Date(Date.now() + 7 * 86_400_000).toISOString()
        history[notificationId] = snoozedUntil
        await chrome.storage.local.set({ [STORAGE_NOTIFIED]: history })
        await chrome.notifications.clear(notificationId)
    })()
})

/**
 * Notification ids are `applyos:<kind>:<applicationId>`. Splitting from the
 * right keeps this working even if the kind ever contains a colon.
 */
async function openApplicationFromNotification(notificationId: string): Promise<void> {
    const applicationId = notificationId.split(':').pop()
    await chrome.notifications.clear(notificationId)
    if (!applicationId) return

    const settings = await getSettings()
    const base = settings ? await getAppBaseUrl() : 'https://www.applyos.io'
    await chrome.tabs.create({ url: `${base}/applications/${applicationId}` })
}

async function getAppBaseUrl(): Promise<string> {
    const stored = await chrome.storage.local.get(['appBaseUrl'])
    return (stored.appBaseUrl as string) || 'https://www.applyos.io'
}

// ---------------------------------------------------------------------------
// Context menu, keyboard shortcuts, AI proxy
// ---------------------------------------------------------------------------

const MENU_FILL_FIELD = 'applyos-fill-field'
const MENU_FILL_FORM = 'applyos-fill-form'
const MENU_CAPTURE = 'applyos-capture'

async function registerContextMenus(): Promise<void> {
    // removeall keeps this idempotent across worker restarts and updates.
    await chrome.contextMenus.removeAll()
    chrome.contextMenus.create({
        id: MENU_FILL_FIELD,
        title: 'Fill this field with ApplyOS',
        contexts: ['editable'],
    })
    chrome.contextMenus.create({
        id: MENU_FILL_FORM,
        title: 'Fill this application with ApplyOS',
        contexts: ['page'],
    })
    chrome.contextMenus.create({
        id: MENU_CAPTURE,
        title: 'Save this job to ApplyOS',
        contexts: ['page'],
    })
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return
    switch (info.menuItemId) {
        case MENU_FILL_FIELD:
            void fillFieldFromContextMenu()
            break
        case MENU_FILL_FORM:
            void fillFormFromCommand()
            break
        case MENU_CAPTURE:
            void captureJobFromCommand()
            break
    }
})

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'fill-form':
            void fillFormFromCommand()
            break
        case 'save-job':
            void captureJobFromCommand()
            break
    }
})

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message?.type) {
        case 'REMINDERS_RUN_NOW':
            runReminderSweep('manual')
                .then((result) => sendResponse({ success: true, ...result }))
                .catch((error) => sendResponse({ success: false, error: String(error) }))
            return true

        case 'BADGE_REFRESH':
            refreshBadgeFromApplications()
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: String(error) }))
            return true

        case 'AI_ANSWER_REQUEST':
            // Content scripts cannot read the Supabase session from
            // chrome.storage; the worker proxies the API call for them.
            proxyAiAnswer(message.question, message.jobDescription, message.previousAnswers)
                .then((result) => sendResponse(result))
                .catch((error) => sendResponse({ answer: null, error: String(error) }))
            return true

        case 'SETTINGS_CHANGED':
            // Rescheduling is not needed (period is fixed), but the badge may now
            // be stale if the user just turned reminders off.
            void refreshBadgeFromApplications()
            sendResponse({ success: true })
            return false

        case 'AUTOFILL_RESULT':
            sendResponse({ success: true })
            return false

        default:
            sendResponse({ error: `Unknown message type: ${message?.type}` })
            return false
    }
})

// Exported for tests and for the popup's "Check now" button.
export { runReminderSweep, updateBadge, scheduleReminderSweep }
