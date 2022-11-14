import { IAccountState } from '@core/account'
import { OUTPUT_TYPE_TREASURY } from '@core/wallet/constants'
import { ActivityDirection } from '@core/wallet/enums'
import { IProcessedTransaction } from '@core/wallet/interfaces'
import { Output, Subject } from '@core/wallet/types'
import { IOutputResponse } from '@iota/types'
import { getSubjectFromAddress } from '../../getSubjectFromAddress'
import { isSubjectInternal } from '../../isSubjectInternal'
import { getRecipientFromOutput } from '../../outputs'
import { getSenderAddressFromInputs, getSenderFromTransaction } from '../../transactions'

export function getSendingInformation(
    processedTransaction: IProcessedTransaction,
    output: Output,
    account: IAccountState,
    isSelfTransaction: boolean = false
): {
    subject: Subject
    direction: ActivityDirection
    isInternal: boolean
    isSelfTransaction: boolean
} {
    const { isIncoming, detailedTransactionInputs } = processedTransaction

    const recipient = getRecipientFromOutput(output)
    const sender = detailedTransactionInputs
        ? getSubjectFromAddress(getSenderAddressFromInputs(detailedTransactionInputs))
        : getSenderFromTransaction(isIncoming, account.depositAddress, output)

    const subject = isIncoming ? sender : recipient
    const isInternal = isSubjectInternal(subject)

    if (isSelfTransaction === false) {
        if (recipient?.type === 'account' && sender?.type === 'account') {
            isSelfTransaction = recipient.account === sender.account
        } else if (recipient?.type === 'address' && sender?.type === 'address') {
            isSelfTransaction = recipient.address === sender.address
        }
    }

    const isBurningOutput = getIsBurningOutput(output, detailedTransactionInputs, isSelfTransaction)

    let direction
    if (isBurningOutput) {
        direction = ActivityDirection.Burning
    } else if (isIncoming || isSelfTransaction) {
        direction = ActivityDirection.Incoming
    } else {
        direction = ActivityDirection.Outgoing
    }

    return {
        subject,
        isInternal,
        direction,
        isSelfTransaction,
    }
}

function getIsBurningOutput(output: Output, inputs: IOutputResponse[], isSelfTransaction: boolean): boolean {
    if (!isSelfTransaction) {
        return false
    }

    const nativeTokens = []
    for (const { output } of inputs ?? []) {
        if (output.type !== OUTPUT_TYPE_TREASURY) {
            nativeTokens.push(...(output.nativeTokens ?? []))
        }
    }

    return nativeTokens.some((token) => output.nativeTokens?.includes(token))
}
