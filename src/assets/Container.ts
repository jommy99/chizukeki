import * as React from 'react'
import { bindActionCreators, Dispatch } from 'redux'
import { connect } from 'react-redux'

import { Redirect } from '../routing/router'
import ActionHistory from '../generics/action-history'
import { routineStages } from '../generics/utils'

import * as Redux from './redux'
import Assets from './Assets' 

let { sendTransaction, sync } = Redux.routines

type Props = {
  wallet: Wallet.Data,
  isSyncing: boolean,
  stages: {
    sync: typeof sync.currentStage,
    sendTransaction: typeof sendTransaction.currentStage,
  }
  actions: {
    sync: typeof sync.trigger
    stopSync: typeof sync.stop
    sendTransaction: typeof sendTransaction.trigger
  }
}


let isSyncing = function isSyncing(routine){
  let selectSyncControls = action => [ routine.stop.type, routine.trigger.type ].includes(action)
  return actionHistory => {
    let latest = ActionHistory.filter(selectSyncControls, actionHistory).latest
    return latest === routine.trigger.type
  }
}(sync)

let selectStages = routineStages({
  sync,
  sendTransaction
})

export default connect(
  ({ wallet: { actionHistory, wallet } }: { wallet: Redux.State }) => {
    return {
      stages: selectStages(actionHistory),
      isSyncing: isSyncing(actionHistory),
      wallet
    }
  },
  (dispatch: Dispatch<any>) => ({ actions: bindActionCreators({
    sync: sync.trigger,
    stopSync: sync.stop,
    sendTransaction: Redux.routines.sendTransaction.trigger
  }, dispatch) })
)(Container)

