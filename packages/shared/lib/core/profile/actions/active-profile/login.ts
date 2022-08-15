import { get } from 'svelte/store'

import { getAndUpdateNodeInfo } from '@core/network'
import { isStrongholdUnlocked } from '@core/profile-manager'
import { startBackgroundSync, subscribe as subscribeToWalletEvents } from '@core/profile-manager/api'

import { INITIAL_ACCOUNT_GAP_LIMIT, INITIAL_ADDRESS_GAP_LIMIT } from '../../constants'
import { activeProfile, setTimeStrongholdLastUnlocked } from '../../stores'
import { loadAccounts } from './loadAccounts'
import { recoverAndLoadAccounts } from './recoverAndLoadAccounts'
import { ProfileType } from '@core/profile/enums'

export async function login(recoverAccounts?: boolean): Promise<void> {
    const { loggedIn, lastActiveAt, id, isStrongholdLocked, type } = get(activeProfile)
    if (id) {
        loggedIn.set(true)
        await getAndUpdateNodeInfo()

        if (recoverAccounts) {
            void recoverAndLoadAccounts(INITIAL_ACCOUNT_GAP_LIMIT[type], INITIAL_ADDRESS_GAP_LIMIT[type])
        } else {
            void loadAccounts()
        }

        lastActiveAt.set(new Date())

        if (type === ProfileType.Software) {
            const strongholdUnlocked = await isStrongholdUnlocked()
            isStrongholdLocked.set(!strongholdUnlocked)
            // TODO: enable once https://github.com/iotaledger/firefly/issues/3693 is resolved
            // setStrongholdPasswordClearInterval(STRONGHOLD_PASSWORD_CLEAR_INTERVAL)
            if (strongholdUnlocked) {
                setTimeStrongholdLastUnlocked()
            }
        }

        void startBackgroundSync({ syncIncomingTransactions: true })

        // enable listeners
        subscribeToWalletEvents()
    }
}
