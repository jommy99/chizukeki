import * as React from 'react'
import { View, Image, Text, StyleSheet  } from 'react-native'
import { Provider } from "react-redux"
import { PersistGate } from 'redux-persist/es/integration/react'
import { ConnectedRouter } from 'react-router-redux'

import { Route, Redirect } from './routing/router'
import DependentRoute from './routing/dependent-route'
import configureStore, { history } from "./store"

import Wallet from './wallet/Container'
import Nav from './Menu'

import { StyleProvider, variables } from 'native-base/src/index';
import theme from './theme'

let { store, persistor } = configureStore()

variables.iconFamily = 'FontAwesome'

export default class App extends React.Component<{}> {
  render() {
    return (
      <Provider store={store}>
        <PersistGate persistor={persistor} loading={<Text>loading</Text>}>
          <ConnectedRouter history={history}>
            <StyleProvider style={theme(variables)}>
              <View style={styles.wrapper}>
                {/*
                TODO will background / logo be optional / configurable on deployment?
                <Image source={require("./assets/logomask.png")}
                  style={styles.background} />
                */}
                <View style={styles.container}>
                  <Nav/>

                  <Route path="/login" exact component={Wallet} />
                  <DependentRoute
                    dependency={{pathname: 'login', prop: 'wallet' }}
                    path="/wallet" exact component={Wallet} />

                  <Route path="/logout" exact render={() => (
                    store.dispatch({ type: 'HARD_LOGOUT' }),
                    <Redirect to='/login'/>
                  )}/>

                </View>
              </View>
            </StyleProvider>
          </ConnectedRouter>
        </PersistGate>
      </Provider>
    )
  }
}


const styles = StyleSheet.create({
  wrapper: {
    minHeight: '100%',
    backgroundColor: '#DADADA'
  },
  background: {
    position: 'absolute',
    height: 300,
    width: 300,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  container: {
    minHeight: '100%',
    paddingTop: 50,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
})
