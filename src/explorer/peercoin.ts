import { plus, minus } from 'number-precision'
import { dropRepeats } from 'ramda'
import bitcore from '../lib/bitcore'
import { HTTP, Satoshis } from '../lib/utils'
import configure from '../configure'
import listunspent from './cryptoid'
import { Wallet, walletMeta } from './common'
import cryptoid from './cryptoid'

let { getJSON, getText, stringifyQuery } = HTTP

// window['bitcore'] = bitcore


namespace ApiCalls {
  export type Coind = 
    | 'getdifficulty'
    | 'connectioncount'
    | 'getblockcount'
    | 'getrawtransaction'
    | 'sendrawtransaction'

  export type Extended = 
    | 'getaddress'
    | 'listunspent'
    | 'txinfo'
    | 'getbalance'

  export type gettxExtended = 
    | 'gettx'
}

type ApiCalls = ApiCalls.Coind | ApiCalls.Extended | ApiCalls.gettxExtended

namespace Unspent {
  export type Output = {
    tx_hash: string,
    script: string,
    // TODO [[explorer.peercoin]] correct and normalize output
    tx_ouput_n: number,
    value: Satoshis,
  }
}
type Unspent = {
  unspent_outputs: Array<Unspent.Output>
}

namespace RawTransaction {
  export type UTXO = {
    value: number,
    n: number,
    scriptPubKey: {
      addresses: Array<string>,
      asm: string,
      hex: string,
      reqSigs: number,
      type: string,
    }
  }
  export type ToSend = {
    unspentOutputs: Array<Wallet.UTXO>,
    toAddress: string,
    amount: number,
    changeAddress: string,
    privateKey: string,
    fee?: number
  }
  export type Relative = RawTransaction & {
    blockindex: number,
    fee: number,
    type: 'CREDIT' | 'DEBIT' | 'SELF_SEND',
    inputTotal: number,
    addresses: Array<string>
  }
}

type RawTransaction = {
  hex: string,
  txid: string,
  time: number,
  confirmations: number,
  vout: Array<RawTransaction.UTXO>,
  vin: Array<any>,
  blockhash: string,
  blocktime: number
}


namespace TxInfo {
  export type Input = {
    addresses: string,
    txid: string, 
    amount: Satoshis
  }
  export type Output = {
    script: string,
    addresses: string,
    amount: Satoshis
  }

  export type Response = {
    hash: string,
    blockindex: number,
    timestamp: number,
    total: Satoshis,
    inputs: Array<Input>,
    outputs: Array<Output>,
  }

}

namespace Gettx {
  export type Input = {
    addresses: string,
    txid: string, 
    amount: Satoshis
  }
  export type Output = {
    script: string,
    addresses: string,
    amount: Satoshis
  }

  export type Response = {
    blockhash: string,
    blockindex: number,
    timestamp: number,
    total: Satoshis,
    vin: Array<Input>,
    vout: Array<Output>,
  }

}

namespace GetAddress {
  type TxReference = string
  export type Transaction = {
    addresses: TxReference,
    type: string
  }
  export type Response = {
    address: string,
    sent: number,
    received: number,
    balance: string,
    last_txs: Array<Transaction>,
  }
}

namespace normalize {

  export const satoshis = Satoshis.toAmount

  export function unspentOutput({ tx_hash, script, tx_ouput_n, value }: Unspent.Output): Wallet.UTXO {
    return {
      txid: tx_hash,
      scriptPubKey: script,
      vout: tx_ouput_n,
      amount: Satoshis.btc.toAmount(value)
    }
  }

  export function vout(txid: string, { n, value, ...raw }: RawTransaction.UTXO): Wallet.UTXO {
    return {
      txid,
      amount: value,
      vout: n,
      ...raw,
    }
  }

  export function transaction(address: string, raw: RawTransaction.Relative){
    let { txid: id, confirmations, time, vout, type, inputTotal, fee, addresses } = raw
    let amount = type === 'CREDIT' ? 0 : -Satoshis.fromAmount(minus(inputTotal, fee))
    for (let out of vout) {
      if (out.scriptPubKey.addresses && out.scriptPubKey.addresses.includes(address)) {
        amount = plus(amount, Satoshis.fromAmount(out.value))
      }
    }
    let assetAction = bitcore.assets.assetActionType(new bitcore.Transaction(raw.hex))
    return {
      id,
      type,
      blockindex: raw.blockindex,
      confirmations,
      addresses,
      amount: Satoshis.toAmount(amount),
      fee,
      balance: NaN,
      timestamp: new Date(time * 1000),
      raw: {
        ...raw,
        vout: vout.map(out => normalize.vout(id, out))
      },
      ...(assetAction ? { assetAction } : {})
    }
  }

  // todo converting to/from satoshis to avoid precision errors is inefficient 
  export function transactions({ address, balance }: Wallet, txs: Array<RawTransaction.Relative>){
    let nTransactions: Array<Wallet.Transaction> = []
    for (let raw of txs.reverse()){
      let tx = normalize.transaction(address, raw)
      tx.balance = balance
      nTransactions.push(tx as Wallet.Transaction)
      balance -= Satoshis.toAmount(tx.amount)
    }
    return nTransactions
  }

  export function wallet(
    { last_txs, balance, ...rest }: GetAddress.Response,
    txs: Array<RawTransaction.Relative>,
    unspentOutputs: Array<Wallet.UTXO>,
    lastSeenBlock: number
  ): Wallet {
    let wallet: Wallet = Object.assign(
      walletMeta({ lastSeenBlock }),
      rest,
      {
        balance: Number(balance),
        transactions: [],
        totalTransactions: txs.length,
        unspentOutputs 
      }
    )
    wallet.transactions = normalize.transactions(wallet, txs)
    return wallet
  }
}


type Error = {
  error: string,
  [key: string]: any
}
function isError(r: any): r is Error {
  return r.hasOwnProperty('error')
}
async function throwing<T>(p: Promise<Error | T>){
  let r = await p
  if(isError(r)){
    throw Error(r.error)
  }
  return r
}

async function defaultOnError<T>(p: Promise<T>, def: T){
  try {
    return p
  } catch {
    return def
  }
}

class PeercoinExplorer {
   explorerUrl = `https://pnddev.digitalpandacoin.org:8088/https://explorer.thepandacoin.net`
  rawApiRequest(call: ApiCalls.Coind, query: object){
    return getText(`${this.explorerUrl}/api/${call}?${stringifyQuery(query)}`)
  }
  apiRequest<T = any>(call: ApiCalls.Coind, query: object, errorMessage = `PeercoinExplorer.api.${call} request returned empty`){
    return getJSON<T | Error>(`${this.explorerUrl}/api/${call}?${stringifyQuery(query)}`, errorMessage)
  }
  extendedRequest<T = any>(call: ApiCalls.Extended, param: string, errorMessage = `PeercoinExplorer.ext.${call} request returned empty`){
    return getJSON<T | Error>(`${this.explorerUrl}/ext/${[ call, param ].join('/')}`, errorMessage)
  }
  gettxRequest<T = any>(call: ApiCalls.gettxExtended, param: string, errorMessage = `PeercoinExplorer.ext.${call} request returned empty`){
    return getJSON<T | Error>(`${this.explorerUrl}/ext/${[ call, param ].join('/')}`, errorMessage)
  }
  getBalance = async (address: string) => {
    let balance = await this.extendedRequest('getbalance', address)
    return Number(balance)
  }

  //listUnspent = async (address: string) => {
    //let { unspent_outputs } = await throwing(this.extendedRequest<Unspent>('listunspent', address))
    //return unspent_outputs.map(normalize.unspentOutput).filter(u => u.amount)
  //}

  getRawTransaction = (txid: string) => this.apiRequest<RawTransaction>('getrawtransaction', { txid, decrypt: 1 })

  _sendRawTransaction = async (hex):
    Promise<Pick<Wallet.PendingTransaction, 'id' | 'timestamp' | 'raw'>> =>
  {
    let response = await this.rawApiRequest('sendrawtransaction', { hex })
    if (response === 'There was an error. Check your console.'){
      throw Error('Invalid Transaction')
    }
    let { vout, vin, ...raw }: {
      hash: string, vin: Array<any>, vout: Array<any>
    } = bitcore.Transaction(hex).toObject()
    return {
      id: raw.hash,
      timestamp: new Date(),
      raw: {
        vout: vout.map(({ satoshis, script, ...txn }, vout) =>
          ({ ...txn, txid: raw.hash, vout, scriptPubKey: script, amount: Satoshis.toAmount(satoshis) })),
        vin: vin,
        ...raw
      }
    }
  }

  sendRawTransaction = async (
    { unspentOutputs, toAddress, amount, changeAddress, privateKey }: RawTransaction.ToSend
  ): Promise<Wallet.PendingTransaction> => {
    let signature = new bitcore.PrivateKey(privateKey)
    let transaction = new bitcore.Transaction()
      .from(unspentOutputs.filter(u => u.amount).map(Satoshis.toBitcoreUtxo))
      .to(toAddress, Satoshis.fromAmount(amount))
      .change(changeAddress)

    let fee = transaction.getFee()
    // TODO need to update available unspent transactions after send locally?
    let sent = await this._sendRawTransaction(transaction.fee(fee).sign(signature).serialize({
      disableDustOutputs: false
    }))
    return {
      amount,
      type: toAddress === changeAddress ? 'SELF_SEND' : 'DEBIT',
      fee: Satoshis.toAmount(fee),
      addresses: [ toAddress ],
      ...sent
    }
  }

  //transactionInfo = (id: string) => this.extendedRequest<TxInfo.Response>('txinfo', id)
  //transactionInfo = (id: string) => this.gettxRequest<Gettx.Response>('gettx', id)
  transactionInfo = (id: string) => cryptoid.privateApiRequest<TxInfo.Response>('txinfo', { t: id })//<TxInfo.Response>('txinfo', id)
  getAddress = (address: string) => this.extendedRequest<GetAddress.Response>('getaddress', address)

  getRelativeRawTransaction = async (id: string, address?: string): Promise<RawTransaction.Relative | Error> => {
    console.log("JRM Start getRelativeRawTr")
    let [raw, info] = await Promise.all([
      this.getRawTransaction(id),
            
      this.transactionInfo(id),
     ])
     if (isError(raw)) {
       return raw
     }
        
     if (isError(info)) {
       return info
     }

     console.log("JRM getRelativeRawTr..", info)
     //console.log("outputs vout ?", info.outputs )
     //console.log("inputs vin ?", info.inputs)
     //console.log(this.transactionInfo)
     let type: 'CREDIT' | 'DEBIT' | 'SELF_SEND' =
     //let type: 'CREDIT' | 'DEBIT' | 'SELF_SEND' = 'CREDIT'
       info.inputs.filter(i => i.addresses === address).length ?
         'DEBIT' :
         'CREDIT'
     console.log("Type", type)
     console.log("outputs vout ?", info.outputs)
     console.log("inputs vin ?", info.inputs)
     //console.log(this.transactionInfo)
      //console.log(info.vin.map(o => o.addresses).filter(a => a !== address))
      //console.log(info.vout.map(o => o.addresses).filter(a => a !== address))

        
      let addresses = dropRepeats(type === 'CREDIT' ?
        
        info.inputs.map(o => o.addresses).filter(a => a !== address) :
        info.outputs.map(o => o.addresses).filter(a => a !== address)
      
      )
      console.log("outputs o.addresses ?", info.outputs)
      if ((type === 'DEBIT') && !addresses.length){
      type = 'SELF_SEND'
      }
          
      let inputTotal = info.inputs.reduce((total, i) => plus(total, i.amount), 0)
      //jrm2let fee = Satoshis.btc.toAmount(minus(inputTotal, info.total))
      let fee = 10
      inputTotal = Satoshis.btc.toAmount(inputTotal)
      return Object.assign(raw, { type, fee, inputTotal, addresses, blockindex: info.blockindex })
      
  }

    getRelativeTransaction = async (id: string, address: string) => {
      console.log("JRM Start getRelativeTr")
      let transaction = await this.getRelativeRawTransaction(id, address)
      if (isError(transaction)){
        return transaction
    }
    return normalize.transaction(address, transaction)
    }

    wallet = async (address: string, cached: Array<string> = []) => {
      console.log("JRM Start wallet async")
      let [ resp, lastSeenBlock ] = await Promise.all([
        this.getAddress(address),
        this.apiRequest<number>('getblockcount', {})
      
      ])
      console.log("JRM checking", address)
      if(isError(lastSeenBlock)){
        lastSeenBlock = 0
      }
      if(isError(resp)){
        if(resp.error === "address not found."){
          return Wallet.empty(address, { lastSeenBlock })
        }
        throw Error(resp.error)
    } else {
      //return Wallet.empty(address, { lastSeenBlock })
      console.log("JRM address found on blockchain ", address, lastSeenBlock)
      console.log("last_txs", resp.last_txs)
      
        let transactions = await Promise.all(
        resp.last_txs
          
         .filter(txn => !cached.includes(txn.addresses))
         .map(txn => this.getRelativeRawTransaction(txn.addresses, address))
      )         
      //console.log("Transactions", transactions)
      let unspent = await defaultOnError(cryptoid.listUnspent(address), [])
      console.log("unspent", unspent)
      //return Wallet.empty(address, { lastSeenBlock })
      // TODO retry sync, background sync? redux-offline?
      return normalize.wallet(
        resp,
        //transactions.filter(t => !isError(t)) as Array<RawTransaction.Relative>,
        transactions as Array<RawTransaction.Relative>,
        unspent,
        lastSeenBlock
      )
    }
  }

} 

export default new PeercoinExplorer()
