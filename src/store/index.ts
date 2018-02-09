import { createStore, Reducer, applyMiddleware } from 'redux';
import { routerReducer, routerMiddleware } from 'react-router-redux'
import createSagaMiddleware from 'redux-saga'

import { persistStore, persistReducer, persistCombineReducers } from 'redux-persist'
import storage from 'redux-persist/es/storage' // handles web/native 

import { createHistory } from '../routing'

import { logger } from './utils'

import * as Wallet from '../wallet/redux'
import * as Assets from '../assets/redux'

export const history = (createHistory as any)({ basename: process.env.PUBLIC_PATH || '/' })

let persist = (key: string, reducer: Reducer<any>) => persistReducer({
  key,
  storage,
  blacklist: ['actionHistory']
}, reducer)

/* Persist to either device or localStorage
 * */
const reducer = persistCombineReducers({
  key: 'root',
  storage,
  blacklist: ['wallet', 'assets']
}, {
  router: routerReducer,
  wallet: persist('wallet', Wallet.reducer),
  assets: persist('assets', Assets.reducer),
})

const saga = createSagaMiddleware()

export default function configureStore() {
  let store = createStore(
    reducer,
    applyMiddleware(saga, logger, routerMiddleware(history)),
  )
  let persistor = persistStore(store)

  saga.run(Wallet.saga)
  saga.run(Assets.saga)

  // todo clean up this is quick and dirty
  store.dispatch(Assets.routines.syncDecks.trigger({}))

  return { store, persistor }
}
