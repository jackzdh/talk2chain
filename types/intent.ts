/**
 * Talk2Chain - 意图类型定义
 * 支持 PAS Transfer、Westend、Frequency 跨链转账，同时支持 ZETA Transfer
 */

export type Chain = 'zetachain' | 'bsc' | 'polkadot' | 'westend' | 'frequency'

export type ActionType = 
  | 'transfer'              // 链内转账
  | 'cross_chain_transfer' // 跨链转账（支持 Westend <-> Frequency，以及其他组合）

export interface Intent {
  action: ActionType
  fromChain?: Chain
  toChain?: Chain
  fromToken?: string        // 支持 'PAS'、'WND'、'FRQ' 和 'ZETA'
  toToken?: string          // 支持 'PAS'、'WND'、'FRQ' 和 'ZETA'
  amount?: string
  recipient?: string
  additionalParams?: Record<string, unknown>
}

export interface LLMResponse {
  intent: Intent
  confidence: number
  reasoning?: string
}

