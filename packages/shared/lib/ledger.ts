import { get, writable } from 'svelte/store'
import { getLedgerStatus } from '@core/profile-manager'

import { closePopup, openPopup, popupState } from './popup'
import { LedgerStatus } from '@iota/wallet'
import { NotificationType } from './typings/notification'

import { localize } from '@core/i18n'

import { isNewNotification, showAppNotification } from './notifications'

let intervalTimer

export interface LedgerExtendedStatus extends LedgerStatus {
    connectionState: LedgerConnectionState
}

export enum LedgerConnectionState {
    AppNotOpen = 'appNotOpen',
    Connected = 'connected',
    Locked = 'locked',
    NotDetected = 'notDetected',
    OtherConnected = 'otherConnected',
    MnemonicMismatch = 'mnemonicMismatch',
}

const LEDGER_STATUS_POLL_INTERVAL = 1500
export const USE_LEDGER_SIMULATOR = false

export const ledgerDeviceStatus = writable<LedgerExtendedStatus>({
    connected: false,
    locked: false,
    blindSigningEnabled: false,
    connectionState: LedgerConnectionState.NotDetected,
})

export async function getLedgerDeviceStatus(
    onConnected: () => void = () => {},
    onDisconnected: () => void = () => {},
    onError: () => void = () => {}
): Promise<void> {
    try {
        const status: LedgerStatus = await getLedgerStatus()

        ledgerDeviceStatus.set(
            Object.assign({}, status, {
                connectionState: determineLedgerDeviceState(status),
            })
        )

        if (get(ledgerDeviceStatus).connected) {
            const isLedgerNotConnectedPopupOpened =
                get(popupState).active && get(popupState).type === 'ledgerNotConnected'

            if (isLedgerNotConnectedPopupOpened) {
                closePopup()
            }

            onConnected()
        } else {
            onDisconnected()
        }
    } catch (error) {
        onError()
    }
}

export function determineLedgerDeviceState(status: LedgerStatus): LedgerConnectionState {
    if (status.locked) {
        return LedgerConnectionState.Locked
    }

    if (status.connected) {
        return status?.app ? LedgerConnectionState.Connected : LedgerConnectionState.AppNotOpen
    } else {
        return LedgerConnectionState.NotDetected
    }
}

export function promptUserToConnectLedger(
    onConnected: () => void | Promise<void> = () => {},
    onCancel: () => void = () => {},
    overridePopup: boolean = false
): void {
    const _onCancel = () => {
        onCancel()
    }
    const _onConnected = () => {
        void onConnected()
    }

    const _onDisconnected = () => {
        if (!get(popupState).active || overridePopup) {
            openLedgerNotConnectedPopup(
                onCancel,
                () => pollLedgerDeviceStatus(LEDGER_STATUS_POLL_INTERVAL, _onConnected, _onDisconnected, _onCancel),
                overridePopup
            )
        }
    }

    getLedgerDeviceStatus(_onConnected, _onDisconnected, _onCancel)
}

export function displayNotificationForLedgerProfile(
    notificationType: NotificationType = 'error',
    allowMultiple: boolean = true,
    checkDeviceStatus: boolean = false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any = null
): string {
    let notificationId

    const _notify = () => {
        const status = get(ledgerDeviceStatus)
        const allowedToNotify = allowMultiple ? true : isNewNotification(notificationType)

        const shouldNotify = allowedToNotify
        if (shouldNotify) {
            const stateErrorMessage = localize(`error.ledger.${status.connectionState}`)
            const errorMessage = error?.error ? localize(error.error) : error
            const message = error ? errorMessage : stateErrorMessage
            notificationId = showAppNotification({
                type: notificationType,
                message,
            })
        }
    }

    if (checkDeviceStatus) {
        getLedgerDeviceStatus()
    } else {
        _notify()
    }

    return notificationId
}

export function isLedgerError(error: { name; type }): boolean {
    if (!error) return false

    let errorType: string = ''
    switch (typeof error) {
        case 'object':
            errorType = error.type || error.name
            break
        case 'string':
            errorType = error
            break
    }

    return errorType?.slice(0, 6) === 'Ledger'
}

export const isPollingLedgerDeviceStatus = writable<boolean>(false)

export function pollLedgerDeviceStatus(
    pollInterval: number = LEDGER_STATUS_POLL_INTERVAL,
    _onConnected: () => void = () => {},
    _onDisconnected: () => void = () => {},
    _onCancel: () => void = () => {}
): void {
    if (!get(isPollingLedgerDeviceStatus)) {
        getLedgerDeviceStatus(_onConnected, _onDisconnected, _onCancel)
        intervalTimer = setInterval(() => {
            getLedgerDeviceStatus(_onConnected, _onDisconnected, _onCancel)
        }, pollInterval)

        isPollingLedgerDeviceStatus.set(true)
    }
}

function openLedgerNotConnectedPopup(
    cancel: () => void = () => {},
    poll: () => void = () => {},
    overridePopup: boolean = false
) {
    if (!get(popupState).active || overridePopup) {
        openPopup({
            type: 'ledgerNotConnected',
            hideClose: true,
            props: {
                handleClose: () => cancel(),
                poll,
            },
        })
    }
}

export function stopPollingLedgerStatus(): void {
    if (get(isPollingLedgerDeviceStatus)) {
        clearInterval(intervalTimer)
        intervalTimer = null
        isPollingLedgerDeviceStatus.set(false)
    }
}
