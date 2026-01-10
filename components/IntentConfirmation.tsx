/**
 * Talk2Chain - 精简的意图确认组件
 */

'use client'

import { Intent } from '../types/intent'
import { CheckCircle2, XCircle, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { getChainDisplayName } from '../lib/chains'

interface IntentConfirmationProps {
  intent: Intent
  onConfirm: (intent: Intent) => void
  onCancel: () => void
  isExecuting?: boolean
  executionStatus?: 'idle' | 'waiting-wallet' | 'success' | 'error'
  errorMessage?: string
}

export default function IntentConfirmation({
  intent,
  onConfirm,
  onCancel,
  isExecuting = false,
  executionStatus = 'idle',
  errorMessage,
}: IntentConfirmationProps) {
  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      cross_chain_transfer: '跨链转账',
      transfer: '链内转账',
    }
    return labels[action] || action
  }

  const getButtonText = () => {
    if (executionStatus === 'success') {
      return '关闭'
    }
    if (isExecuting) {
      return '处理中...'
    }
    return '确认'
  }

  return (
    <div className="mt-4">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
        {/* 标题栏 */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200/60 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">操作详情</h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200/60">
              {getActionLabel(intent.action)}
            </span>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-4 space-y-4">
          {/* 链信息 */}
          {(intent.fromChain || intent.toChain) && (
            <div className="flex items-center gap-3">
              {intent.fromChain && (
                <div className="flex-1 bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">源链</span>
                    <span className="text-sm font-medium text-gray-900">
                      {getChainDisplayName(intent.fromChain)}
                    </span>
                  </div>
                </div>
              )}
              {intent.fromChain && intent.toChain && (
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              {intent.toChain && (
                <div className="flex-1 bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">目标链</span>
                    <span className="text-sm font-medium text-gray-900">
                      {getChainDisplayName(intent.toChain)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 代币信息 */}
          {(intent.fromToken || intent.toToken) && (
            <div className="flex items-center gap-3">
              {intent.fromToken && (
                <div className="flex-1 bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">代币</span>
                    <span className="text-sm font-medium text-gray-900">{intent.fromToken}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 金额 */}
          {intent.amount && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg px-4 py-3 border border-blue-200/60 shadow-sm">
              <span className="text-xs text-blue-600 font-medium mb-1 block">金额</span>
              <span className="text-base font-bold text-blue-900">{intent.amount} PAS</span>
            </div>
          )}

          {/* 接收地址 */}
          {intent.recipient && (
            <div className="bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-200/60">
              <span className="text-xs text-gray-500 block mb-1">接收地址</span>
              <span className="text-sm font-mono text-gray-900 break-all">{intent.recipient}</span>
            </div>
          )}

          {/* 执行状态 */}
          {isExecuting && (
            <div className="mt-3 pt-3 border-t border-gray-200/60">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>交易确认中...</span>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {errorMessage && executionStatus === 'error' && (
            <div className="mt-2.5 bg-red-50/80 rounded-lg p-2.5 border border-red-200/60">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-red-900 mb-1">操作失败</div>
                  <div className="text-xs text-red-700 break-words">{errorMessage}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 flex gap-3">
        {executionStatus === 'success' ? (
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            关闭
          </button>
        ) : (
          <>
            <button
              onClick={() => onConfirm(intent)}
              disabled={isExecuting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {getButtonText()}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {getButtonText()}
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={isExecuting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-700 rounded-lg text-sm font-medium transition-all"
            >
              <XCircle className="w-4 h-4" />
              取消
            </button>
          </>
        )}
      </div>
    </div>
  )
}

