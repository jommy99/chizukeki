import * as React from 'react'
import { View, Platform } from 'react-native'
import RoutineButton from '../generics/routine-button'
import {
  Container,
  Segment,
  Header,
  Content,
  Card,
  CardItem,
  Text,
  H2,
  H3,
  Body,
  Input,
  Button,
  Item,
  Left,
  Icon,
  Label,
  variables
} from 'native-base'

import bitcore from '../lib/bitcore'
import { Wrapper } from '../generics/Layout'

import { WrapActionable } from '../wallet/UnlockModal'
import Wallet from '../wallet/Wallet'

import Summary from './Summary'
import { Deck } from './papi'

import Field from '../generics/Field'

type Recipient = { address: string, amount: number }

namespace SendAsset {
  export interface Data {
    assetSpecificData: string
    amountsMap: {
      [address: string]: number
    }
  }
  // todo proper deckSpawn typing
  export type Payload = Data & { wallet: Wallet.Unlocked, deck: Deck.Full }
  interface SendAssetProps {
    stage?: string | undefined,
    send: (data: Payload) => any,
    wallet: Wallet.Data,
    asset: Summary.Asset
  }
  export type Props = SendAssetProps
}

let smallTextStyle = {
  lineHeight: 14,
  fontSize: 12,
  flex: 0,
  ...(Platform.OS === 'web' ? { textOverflow: 'ellipsis' } : {}),
}

let grid = {
  row: { marginRight: -7.5, marginLeft: -7.5 },
  column: { marginRight: 7.5, marginLeft: 7.5 },
}

function isFilled(s: SendAsset.Data): s is SendAsset.Data {
  return Boolean(Object.keys(s.amountsMap).length)
}

function Recipient(
  { address, amount, decimals, remove }:
  Recipient & { decimals: number, remove: () => void }
) {
  return (
    <CardItem styleNames='recipient'>
      <Body styleNames='row underlined'>
        <Text ellipsizeMode='middle' numberOfLines={1}
          style={[smallTextStyle, { flex: 2 }]} styleNames='recipient column'>{address}</Text>
        <Text style={[smallTextStyle, { flex: 1 }]} styleNames='amount column'>{amount.toFixed(decimals)}</Text>
        <Button style={{ height: 30 }} styleNames='warning transparent' onPress={remove}>
          <Icon name='minus' />
        </Button>
      </Body>
    </CardItem>
  )
}

class AddRecipient extends React.Component<{
  decimals: number, add: (r: Recipient) => any, disabled: boolean
}, Recipient> {
  state = {
    address: '',
    amount: 0,
  }
  setAmount = (num: string) => {
    this.setState({
      amount: Number(num)
    })
  }
  normalizedState = () => {
    let { amount, address } = this.state
    let decimals = this.props.decimals
    return {
      address,
      amount: Math.round(Number(amount) * Math.pow(10, decimals)) / Math.pow(10, decimals)
    }
  }
  ok = () => {
    let { address, amount } = this.normalizedState()
    return address && amount
  }
  add = () => {
    let { address, amount } = this.normalizedState()
    if (address && amount) {
      this.props.add({ address, amount })
      this.setState({
        address: '',
        amount: 0,
      })
    }
  }
  render() {
    let { address, amount } = this.state
    let ok = this.ok()
    return (
      <CardItem>
        { this.props.disabled
          ? <View style={{
              backgroundColor: 'rgb(240, 173, 78)',
              width: '100%',
              height: 40,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={{ color: 'white' }}>You can only make 40 card transfers at a time</Text>
            </View>
          : <Body styleNames='row' style={grid.row}>
              <Field styleNames='stacked column collapsing' style={grid.column}>
                {ref => [
                  <Label key={0}>To address</Label>,
                  <Input
                    key={1}
                    ref={ref}
                    style={smallTextStyle}
                    value={address}
                    placeholder='...'
                    onChangeText={address => this.setState({ address })} />
                ]}
              </Field>
              <Field styleNames='stacked column collapsing' style={grid.column}>
                {ref => [
                  <Label key={0}>Amount</Label>,
                  <Input
                    key={1}
                    ref={ref}
                    keyboardType='numeric'
                    placeholder='0.00'
                    style={smallTextStyle}
                    value={`${this.state.amount || ''}`}
                    onChangeText={this.setAmount} />
                ]}
              </Field>
              <Button
                style={{
                  ...grid.column,
                  height: 43,
                  marginTop: 20,
                  flexGrow: 1,
                  justifyContent: 'center'
                }}
                disabled={!ok}
                styleNames={`${ok ? 'success' : 'dark'} bordered`} onPress={this.add}>
                <Icon name='plus' style={{ opacity: ok ? 1 : 0.5 }} />
              </Button>
            </Body>
        }
      </CardItem>
    )

  }
}

function SendButton({ totalAmount, name, ...props }: {
  totalAmount: number,
  name: string,
  stage: undefined | string,
  DEFAULT: string,
  disabled: boolean,
  onPress: () => any
}){
  return (
    <RoutineButton styleNames='block'
      icons={{ DEFAULT: 'send' }}
      toasts={{ DONE: `Sent ${totalAmount} ${name}` }}
      STARTED='Sending'
      DONE='Sent!'
    //FAILED='Invalid Transaction'   JRM2 all tx show this most work fine though??
      FAILED='Sending!'
      {...props} />
  )
}

class SendAsset extends React.Component<SendAsset.Props, SendAsset.Data> {
  state: SendAsset.Data = {
    assetSpecificData: '',
    amountsMap: {},
  }
  send = (privateKey: string) => {
    let { wallet, asset, send } = this.props
    if(isFilled(this.state) && Deck.isFull(asset.deck)){
      let wallet = Object.assign({ privateKey }, this.props.wallet)
      send({ wallet, ...this.state, deck: asset.deck })
    }
  }
  render() {
    let {
      asset: { deck: { name, decimals }, balance: { type, value: balance = 0 } },
      wallet: { keys }
    } = this.props

    let { assetSpecificData, amountsMap } = this.state
    let totalAmount = Object.values(this.state.amountsMap).reduce((s, v) => s + v, 0)
    let transactionType = type === 'RECEIVED' ? 'Send' : 'Issue'
    let canSendAmount = (transactionType === 'Issue' || (totalAmount < balance))

    let remove = (address: string) => () => {
      let { [address]: _, ...amountsMap } = this.state.amountsMap
      this.setState({ amountsMap })
    }

    let recipientCount = Object.keys(amountsMap).length 
    let headers = { address: 'Add recipents to send a transaction',  }
    return (
      <Card style={{width: '100%', flex: 0 }}>
        <CardItem styleNames='header'>
          <Left>
            <H2 style={{ flexBasis: 200, paddingBottom: 0 }}>{transactionType} {name}</H2>
          </Left>
        </CardItem>
        <CardItem>
          <Body styleNames='row'>
            <Text style={{ flex: 2 }} styleNames='recipient column'>Recipient Addresses</Text>
            <Text style={{ flex: 1 }} styleNames='amount column'>Amounts</Text>
            <View style={{ justifyContent: 'space-between', paddingRight: 17, paddingTop: 8 }}>
              <Icon name='send' style={{ fontSize: 18 }} />
            </View>
          </Body>
        </CardItem>
        {Object.entries(amountsMap).map(([ address, amount ]) =>
          <Recipient key={address} {...{ decimals, address, amount, remove: remove(address) }} />)}
        <AddRecipient
            disabled={Object.keys(amountsMap).length >= 40}
            decimals={decimals} add={({ address, amount }: Recipient) =>
            this.setState({ amountsMap: { ...amountsMap, [address]: amount } })} />
        <CardItem>
          <Body styleNames='row' style={{ paddingTop: 0 }}>
            <Field styleNames='stacked column collapsing'>
              {ref => [
                <Label key={0}>Asset Specific Data</Label>,
                <Input
                  multiline
                  numberOfLines={3}
                  key={1}
                  ref={ref}
                  style={[
                    smallTextStyle,
                    { marginTop: 5, paddingTop: 5 },
                    Platform.OS === 'web' ? { resize: 'vertical' } as any : {}
                  ]}
                  value={assetSpecificData}
                  placeholder='add a note or metadata'
                  onChangeText={assetSpecificData => this.setState({ assetSpecificData })}
                  />
              ]}
            </Field>
          </Body>
        </CardItem>
        <CardItem styleNames='footer'>
          <Body>
            <WrapActionable.IfLocked
              keys={keys}
              actionProp='onPress'
              action={this.send}
              Component={SendButton}
              componentProps={{
                disabled: (!isFilled(this.state)) || (!canSendAmount) || !Deck.isFull(this.props.asset.deck),
                stage: this.props.stage,
                DEFAULT: !canSendAmount ? 'Insufficient Funds!' : `${transactionType} Asset`,
                totalAmount,
                name
              }}
            />
          </Body>
        </CardItem>
      </Card>
    )
  }
}


export default SendAsset
