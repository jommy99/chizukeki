import { HTTP, Satoshis } from '../lib/utils'
import { Wallet, walletMeta } from './common'
let { getJSON, stringifyQuery } = HTTP

namespace ApiCalls {
  export type Public =
    | 'getblockcount'
    | 'getdifficulty'
    | 'getreceivedbyaddress'

  export type Private =
    | 'getbalance'
    | 'unspent'
    | 'multiaddr'
    | 'txinfo'
}
type ApiCalls = ApiCalls.Public | ApiCalls.Private

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

namespace MultiAddress {
  export type Transaction = {
    hash: string,
    confirmations: number,
    change: number,
    time_utc: string,
    n?: number
  }
  export type Response = {
    addresses: [{
      address: string,
      total_sent: number,
      total_received: number,
      final_balance: number,
      n_tx: number
    }]
    txs: Array<Transaction>
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
  export function transactions(balance: number, txs: Array<MultiAddress.Transaction>) {
    let nTransactions: Array<Wallet.Transaction> = []
    for (let i = 0; i < txs.length; i++) {
      let {
        hash: id,
        confirmations,
        change,
        time_utc,
        n = 1,
      } = txs[i]
      // consume subsequent transaction segments if n > 1
      while (n-- > 1) {
        i++
        change += txs[i].change
      }
      let amount = Satoshis.toAmount(change)
      nTransactions.push({
        type: 'DEBIT',
        id,
        blockindex: NaN,
        fee: NaN, // todo cryptoid is a WIP
        confirmations,
        amount,
        balance,
        addresses: [],
        timestamp: new Date(time_utc),
      })
      balance -= amount
    }
    return nTransactions
  }
  export function wallet(address: string, {
      addresses: [{
        total_received = 0,
        total_sent = 0,
        final_balance = 0,
        n_tx: totalTransactions = 0
      } = {}],
        txs
    }: MultiAddress.Response, unspentOutputs: Array<Wallet.UTXO>): Wallet {
    let [received, sent, balance] = [
      total_received, total_sent, final_balance
    ].map(Satoshis.toAmount)
    return {
      ...walletMeta(),
      address,
      unspentOutputs,
      balance,
      received,
      sent,
      totalTransactions,
      transactions: normalize.transactions(balance, txs)
    }
  }

}
type Error = {
    error: string,
    [key: string]: any
}
function isError(r: any): r is Error {
    return r.hasOwnProperty('error')
}
async function throwing<T>(p: Promise<Error | T>) {
    let r = await p
    if (isError(r)) {
        throw Error(r.error)
    }
    return r
}

async function defaultOnError<T>(p: Promise<T>, def: T) {
    try {
        return p
    } catch {
        return def
    }
}


class Cryptoid {
  explorerUrl = 'https://pnddev.digitalpandacoin.org:8088/https://chainz.cryptoid.info'  //uses cors anywhere
  constructor(private key: string = '7547f94398e3', private network: string = 'pnd') { }
  apiRequest<T = any>(call: ApiCalls, query: object){
    let { explorerUrl, network } = this
    return getJSON<T>(`${explorerUrl}/${network}/api.dws?q=${call}&${stringifyQuery(query)}`)
  }
  private publicApiRequest = async (call: ApiCalls.Public, query: object) =>
    this.apiRequest(call, query)
  privateApiRequest<T = any>(call: ApiCalls.Private, query: object){
    return this.apiRequest<T>(call, { key: this.key, ...query })
  }

  getBalance = async (address: string) => {
    let balance = await this.privateApiRequest('getbalance', { a: address })
    return Number(balance)
  }

  listUnspent = async (active: string) => {
      //let { unspent_outputs } = await this.privateApiRequest<{ unspent_outputs: Array<Wallet.UTXO> }>('listunspent', { active: address })
      let { unspent_outputs } = await throwing(this.privateApiRequest<Unspent>('unspent', { active: active }))
   // let { unspent_outputs } = await throwing(this.extendedRequest<Unspent>('listunspent', address))
   // return unspent_outputs
    return unspent_outputs.map(normalize.unspentOutput).filter(u => u.amount)
  }

  getReceivedByAddress = async (address: string) => {
    let amount = await this.publicApiRequest('getreceivedbyaddress', { a: address })
    return Number(amount)
    }
  /*
  //transactionInfo = (id: string) => this.extendedRequest<TxInfo.Response>('txinfo', id)
  //transactionInfo = (id: string) => this.gettxRequest<Gettx.Response>('gettx', id)
  //getAddress = (address: string) => this.extendedRequest<GetAddress.Response>('getaddress', address)

    getRelativeRawTransaction = async (id: string, address?: string): Promise<RawTransaction.Relative | Error> => {

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
        //JRM temp hard code to type = 'SELF_SEND'
        //let type: 'CREDIT' | 'DEBIT' | 'SELF_SEND' = 'CREDIT'
        //info.inputs.filter(i => i.addresses === address).length
        let type: 'CREDIT' | 'DEBIT' | 'SELF_SEND' =
            info.vin.filter(i => i.addresses === address).length ?
                'DEBIT' :
                'CREDIT'

        let addresses = dropRepeats(type === 'CREDIT' ?
            //JRM
            //console.log("CREDIT now trying to filter")
            info.vin.map(o => o.addresses).filter(a => a !== address) :
            info.vout.map(o => o.addresses).filter(a => a !== address)
        )
        if ((type === 'DEBIT') && !addresses.length) {
            type = 'SELF_SEND'
        }

        let inputTotal = info.vin.reduce((total, i) => plus(total, i.amount), 0)
        let fee = Satoshis.btc.toAmount(minus(inputTotal, info.total))
        inputTotal = Satoshis.btc.toAmount(inputTotal)
        return Object.assign(raw, { type, fee, inputTotal, addresses, blockindex: info.blockindex })

    }

    getRelativeTransaction = async (id: string, address: string) => {
        let transaction = await this.getRelativeRawTransaction(id, address)
        if (isError(transaction)) {
            return transaction
        }
        return normalize.transaction(address, transaction)
    }

  */
  wallet = async (address: string) => {
    let resp = await this.privateApiRequest('multiaddr', { active: address })
    let unspent = await this.listUnspent(address)
    if (resp) {
      return normalize.wallet(address, resp as MultiAddress.Response, unspent)
    } else {
      throw Error('could not sync with cryptoid')
    }
  }

  // NOTE: block requests wouldn't work because cryptoid doesn't have cors enabled on these endpoints, so let's use a cors anywhere go between
  
  private blockRequest = (call, query: object & { id: string }) => {
    let { explorerUrl, network } = this
      return getJSON(`${explorerUrl}/explorer/${call}.dws?coin=${network}&${stringifyQuery(query)}`)
  }

  getRawTransaction = async (txid: string, hex?: boolean) => {
    let query = hex ? { hex, id: txid } : { id: txid }
    let resp = await this.blockRequest('tx.raw', query)
    return hex ? resp.hex : resp
  }

  listTransactions = async (address: string) => {
    let resp = await this.blockRequest('address.summary', { id: address })
    if(resp){
      return resp.tx.map(([_0, txid, _2, _3, value, balance]) =>
        ({ balance, value, id: txid.toLowerCase() }))
    }
  }
  /*
  summary = async (address: string) => {
    type AddressSummary = {
      tx: Array<[any, string, any, any, number, number]>,
      received: number,
      sent: number,
      balance: number
      [rest: string]: any
    }

    let resp = await this.blockRequest('address.summary', { id: address })
    if(resp){
      // unused fields: block, stake, stakenb, stakeIn, stakeOut receivednb, sentnb
      let { tx = [], received = '0', sent = '0', balance = '0' }: AddressSummary = resp;
      [received, sent, balance] = [received, sent, balance].map(normalizeSatoshis)
      let transactions = tx.map(([_0, txid, _2, _3, value, balance]) =>
        ({ balance, value, id: txid.toLowerCase() }))
      let wallet: Wallet = { received, sent, balance, transactions }
      return wallet
    } else {
      throw Error('could not sync with cryptoid')
    }
  }
  / * TODO block requests still don't work on chainz aka Cryptoid */

}

export default new Cryptoid()
