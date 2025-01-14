import * as React from 'react'
import { View, Platform } from 'react-native'
import { Button, Card, CardItem, Text, H2, Badge, Switch, Toast } from 'native-base'

import FlatList from '../generics/FlatList'
import moment from 'moment'

import { Secondary } from '../generics/Layout'
import Transaction from '../generics/transaction-like'
import { Wallet, Satoshis } from '../explorer/common'

namespace WalletTransaction {
  export type Data = Wallet.Transaction
}

function AssetAction({ assetAction }: { assetAction?: string }){
  return assetAction ?
    <Badge styleNames='info' style={{ height: 22 }}>
      <Text style={{ fontSize: 12 }}>{assetAction}</Text>
    </Badge> :
    null
}

type TransactionDetailsProps = Pick<WalletTransaction.Data, 'id'>
  & Partial<WalletTransaction.Data>
  & { asset?: boolean }
  & { children?: React.ReactNode }

function TransactionDetails({
  type, confirmations, id, assetAction, amount, fee, asset, children
}: TransactionDetailsProps) {
  return (
    <CardItem styleNames='footer' style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {children}
      <Text styleNames='bounded note' ellipsizeMode='middle' numberOfLines={1}>
        id: {id}
      </Text>
      <Text styleNames='bounded note' ellipsizeMode='middle' numberOfLines={1}>
        confirmations: {confirmations || 'pending'}
      </Text>
      {
        (!asset && amount !== undefined && fee !== undefined) && [
          <Text key='amount' styleNames='bounded note' ellipsizeMode='middle' numberOfLines={1}>
            amount: {amount}
          </Text>,
          <Text key='fee' styleNames='bounded note' ellipsizeMode='middle' numberOfLines={1}>
            fee: { type === 'CREDIT' ? fee : -fee }
          </Text>
        ]
      }
      {
        assetAction ? <AssetAction key='action' assetAction={assetAction}/> : null
      }
    </CardItem>
  )
}

interface TransactionProps extends WalletTransaction.Data {
  hide?: boolean,
  address: string
}

class WalletTransaction extends React.PureComponent<TransactionProps> {
  render() {
    let { type, address, hide, amount, ...item } = this.props
    // include fee in debit display
    let totalAmount = type === 'DEBIT' ?
      Satoshis.toAmount(Satoshis.fromAmount(amount) - Satoshis.fromAmount(item.fee)) :
      amount
    if (hide) {
      return null
    }
    return (
      <Transaction
        type={type}
        amount={totalAmount}
        {...item}
        asset={<Text>PND <AssetAction assetAction={item.assetAction}/></Text>}>
        <TransactionDetails type={type} amount={amount} {...item} />
      </Transaction>
    )
  }
}

namespace TransactionList {
  export type Data = Array<WalletTransaction.Data>
}

class TransactionList extends React.Component<
  { address: string, transactions: TransactionList.Data },
  { showAssets: boolean }
> {
  toggleFilter = (showAssets = !this.state.showAssets) => {
    console.log({ showAssets }) ||
    this.setState({ showAssets })
    Toast.show({
      text: `${ showAssets ? 'Showing' : 'Hiding'} Asset Transactions`,
      position: 'bottom'
    })

  }
  constructor(props){
    super(props)
    this.state = { showAssets: true }
  }
  render() {
    let showAssets = this.state.showAssets
    let { address, transactions } = this.props
    let style = {
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingLeft: 3,
      paddingRight: 3,
    }
    return (
      <Secondary>
        <View style={style as any}>
          <Text>
            <H2>Transactions</H2>
            <Text styleNames='note'> {transactions.length} total </Text>
          </Text>
          <Button styleNames={`${Platform.OS === 'web' ? 'small' : ''} info`} onPress={() => this.toggleFilter()}
            style={{ paddingLeft: 0, paddingRight: 10 }} >
            <Text>Asset Actions</Text>
            <Switch value={showAssets} />
          </Button>
        </View>
        <FlatList
          data={transactions.map(item => item.assetAction ? { hide: !showAssets, ...item } : item)}
          keyExtractor={t => t.id}
          renderItem={({ item }) =>
            <WalletTransaction address={address} key={item.id} {...item} />
          }/>
      </Secondary>
    )
  }
}

export { WalletTransaction, TransactionDetails }
export default TransactionList
