import IssueMode from './assets/issueModes'

const deckSpawnTagHashes = {
  'MAINNET_PRODUCTION': 'PW8RpmJd5A8d8463g2HinboHRkW7mQDvHW',
  'MAINNET_TESTING': 'PAtesth4QreCwMzXJjYHBcCVKbC4wjbYKP',
  'TESTNET_PRODUCTION': 'miHhMLaMWubq4Wx6SdTEqZcUHEGp8RKMZt',
  'TESTNET_TESTING': 'mvfR2sSxAfmDaGgPcmdsTwPqzS6R9nM5Bo',
}

function getDeckSpawnTagHash(network: 'MAINNET' | 'TESTNET', mode: 'PRODUCTION' | 'TESTING'): string {
  return deckSpawnTagHashes[`${network}_${mode}`]
}

namespace Configuration {
  export type Network = 'MAINNET' | 'TESTNET'
  export type DeploymentMode = 'PRODUCTION' | 'TESTING'
  export type KeyGenerator = 'SINGLETON' | 'HD'
  export type NodeEnv = 'PRODUCTION' | 'DEVELOPMENT'

  //todo io-ts
  export function validator<T>(name: string, options: Array<T>, defaultValue?: T) {
    function is(u: any): u is T {
      //todo I have no idea why includes is unrecognized without this casting, as it's recognized elsewhere
      return (options as any).includes(u)
    }
    let invalidMessage = u => `invalid option for ${name} supplied: ${u}`
    function from(u: any) {
      if(is(u)){
        return u
      }
      if (defaultValue !== undefined) {
        if (u !== undefined) {
          console.warn(`${invalidMessage(u)}. Using default ${defaultValue}`)
        }
        return defaultValue
      }
      throw Error(invalidMessage(u))
    }
    function fromEnv(u: any = process.env[name.toUpperCase()]) {
      if(is(u)){
        return u
      }
      if (defaultValue !== undefined) {
        if (u !== undefined) {
          console.warn(`${invalidMessage(u)}. Using default ${defaultValue}`)
        }
        return defaultValue
      }
      throw Error(invalidMessage(u))
    }
    return { from, fromEnv }
  }

  //JRMexport const network = validator<Network>('network', [ 'MAINNET', 'TESTNET' ], 'MAINNET')
  //JRMexport const deploymentMode = validator<DeploymentMode>('network', [ 'PRODUCTION', 'TESTING' ], 'PRODUCTION')
  export const network = validator<Network>('network', [ 'MAINNET' ], 'MAINNET')
  export const deploymentMode = validator<DeploymentMode>('network', [ 'PRODUCTION' ], 'PRODUCTION')     //jrm hard code Mainnet production for now
  export const keyGenerator = validator<KeyGenerator>('key_generator', [ 'SINGLETON', 'HD' ], 'SINGLETON')
  export const nodeEnv = validator<NodeEnv>('NODE_ENV', [ 'PRODUCTION', 'DEVELOPMENT' ], 'DEVELOPMENT')
  //JRMexport const nodeEnv = validator<NodeEnv>('NODE_ENV', [ 'PRODUCTION', 'DEVELOPMENT' ], 'PRODUCTION')

  // todo write actual issue modes validator

  type FullConfiguration = {
    NODE_ENV: NodeEnv
    NETWORK: Network
    DEPLOYMENT_MODE: DeploymentMode
    ASSETS: {
      deckSpawnTagHash: string
      minTagFee: number
      transferPPCAmount: number
    }
    PUBLIC_PATH: "/" | string
    KEY_GENERATOR: KeyGenerator
    VALID_ISSUE_MODES: Array<IssueMode>
  }

  var cachedFromEnv: FullConfiguration
  export function fromEnv(){
    if(cachedFromEnv){
      return cachedFromEnv
    }
    let NETWORK = network.fromEnv()
    let DEPLOYMENT_MODE = deploymentMode.fromEnv()
    let ASSETS = {
      deckSpawnTagHash: getDeckSpawnTagHash(NETWORK, DEPLOYMENT_MODE),
      minTagFee: 10.00,
      transferPPCAmount: 10.00
    }
    let PUBLIC_PATH = process.env.PUBLIC_PATH || '/'
    let KEY_GENERATOR = keyGenerator.fromEnv()
    let NODE_ENV = nodeEnv.fromEnv()
    let VALID_ISSUE_MODES = (
      process.env.VALID_ISSUE_MODES || ''
    ).split(',') as Array<IssueMode>
    cachedFromEnv = {
      NODE_ENV,
      NETWORK,
      DEPLOYMENT_MODE,
      ASSETS,
      PUBLIC_PATH,
      KEY_GENERATOR,
      VALID_ISSUE_MODES
    }
    return cachedFromEnv
  }
}

export default Configuration
