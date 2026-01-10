/**
 * Talk2Chain - Polkadot 测试网跨链操作
 * 支持 Westend <-> Frequency 跨链转账，同时支持 Polkadot Hub TestNet -> BSC 和 ZetaChain -> BSC
 */

import { ethers } from 'ethers'
import { Intent, Chain } from '../types/intent'
import { switchToChain } from './chains'

/**
 * 获取 Gateway 合约地址
 * 从环境变量读取（客户端使用 NEXT_PUBLIC_ 前缀）
 */
function getGateway(chain: Chain): string {
  switch (chain) {
    case 'westend':
      return process.env.NEXT_PUBLIC_WESTEND_GATEWAY || '0xcce1CA0bDC1A95Ca43bBc18677cf377A627ea34f'
    case 'frequency':
      return process.env.NEXT_PUBLIC_FREQUENCY_GATEWAY || '0xcce1CA0bDC1A95Ca43bBc18677cf377A627ea34f'
    case 'polkadot':
      return process.env.NEXT_PUBLIC_POLKADOT_GATEWAY || '0xcce1CA0bDC1A95Ca43bBc18677cf377A627ea34f'
    default:
      return process.env.NEXT_PUBLIC_POLKADOT_GATEWAY || '0xcce1CA0bDC1A95Ca43bBc18677cf377A627ea34f'
  }
}

/**
 * GatewayZEVM 合约 ABI
 */
const GATEWAY_ABI = [
  'function sendDot(uint256 destinationChainId, bytes calldata destinationAddress, uint256 destinationGasLimit) external payable',
  'function availableChainIds(uint256) external view returns (bool)',
]

/**
 * 链 ID 配置
 */
const CHAIN_IDS: Record<Chain, number> = {
  westend: 2000,
  frequency: 2001,
  polkadot: 420420421,
  bsc: 56,
  zetachain: 7000,
}

/**
 * 最小跨链金额配置
 */
const MIN_AMOUNTS: Record<Chain, bigint> = {
  westend: ethers.parseEther('0.01'),
  frequency: ethers.parseEther('0.01'),
  polkadot: ethers.parseEther('0.23'),
  bsc: ethers.parseEther('0.01'),
  zetachain: ethers.parseEther('0.01'),
}

/**
 * 代币符号配置
 */
const TOKEN_SYMBOLS: Record<Chain, string> = {
  westend: 'WND',
  frequency: 'FRQ',
  polkadot: 'PAS',
  bsc: 'BNB',
  zetachain: 'ZETA',
}

/**
 * Westend <-> Frequency 跨链转账
 */
export async function westendFrequencyCrossChainTransfer(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('🔍 Westend/Frequency 跨链转账:', intent)

  // 验证参数
  if (
    !(
      (intent.fromChain === 'westend' && intent.toChain === 'frequency') ||
      (intent.fromChain === 'frequency' && intent.toChain === 'westend')
    )
  ) {
    throw new Error('仅支持 Westend <-> Frequency 之间的跨链转账')
  }

  if (!intent.amount) {
    throw new Error('缺少转账金额')
  }

  // 确保连接到源链
  await switchToChain(intent.fromChain!)

  // 重新获取 provider 和 signer（切换网络后）
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }
  const newProvider = new ethers.BrowserProvider(window.ethereum)
  const newSigner = await newProvider.getSigner()

  // 获取用户地址和接收地址
  const userAddress = await newSigner.getAddress()
  const recipientAddress = intent.recipient || userAddress

  // 验证接收地址格式
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`接收地址格式不正确: ${recipientAddress}`)
  }

  // 转换金额
  const amount = ethers.parseEther(intent.amount)

  // 检查最小金额
  const minAmount = MIN_AMOUNTS[intent.fromChain!]
  if (amount < minAmount) {
    const tokenSymbol = TOKEN_SYMBOLS[intent.fromChain!]
    throw new Error(
      `跨链金额太小，最小要求: ${ethers.formatEther(minAmount)} ${tokenSymbol}`
    )
  }

  // 检查余额
  const balance = await newProvider.getBalance(userAddress)
  const gasEstimate = BigInt(200000)
  const gasPrice = (await newProvider.getFeeData()).gasPrice || BigInt(10000100000)
  const gasFee = gasEstimate * gasPrice
  const requiredAmount = amount + gasFee

  if (balance < requiredAmount) {
    const tokenSymbol = TOKEN_SYMBOLS[intent.fromChain!]
    throw new Error(
      `余额不足。需要: ${ethers.formatEther(requiredAmount)} ${tokenSymbol}，当前: ${ethers.formatEther(balance)} ${tokenSymbol}`
    )
  }

  // 获取 Gateway 合约地址
  const gatewayAddress = getGateway(intent.fromChain!)
  console.log(`使用 ${intent.fromChain} Gateway 地址:`, gatewayAddress)

  // 创建合约实例
  const gatewayContract = new ethers.Contract(
    gatewayAddress,
    GATEWAY_ABI,
    newSigner
  )

  // 检查目标链是否在白名单中
  const destinationChainId = CHAIN_IDS[intent.toChain!]
  const isChainAvailable = await gatewayContract.availableChainIds(destinationChainId)
  if (!isChainAvailable) {
    throw new Error(`${intent.toChain} 链未在 Gateway 白名单中`)
  }

  // 编码接收地址为 bytes（20 字节）
  const addressBytes = ethers.getBytes(recipientAddress)
  const receiverBytes = ethers.hexlify(addressBytes).toLowerCase()

  // 调用 sendZeta
  const destinationGasLimit = 90000
  const txGasLimit = 200000

  console.log('调用 sendDot，参数:', {
    destinationChainId,
    destinationAddress: receiverBytes,
    destinationGasLimit,
    amount: intent.amount,
  })

  console.log('⏳ 请在 MetaMask 中确认跨链交易...')
  
  const tx = await Promise.race([
    gatewayContract.sendDot(
      destinationChainId,
      receiverBytes,
      destinationGasLimit,
      {
        value: amount,
        gasLimit: txGasLimit,
      }
    ),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('交易确认超时（5分钟）')), 5 * 60 * 1000)
    )
  ]) as ethers.ContractTransactionResponse

  console.log('✅ 跨链转账交易已发送:', tx.hash)

  // 等待交易确认
  let receipt: ethers.TransactionReceipt | null = null
  let retries = 5
  let delay = 3000

  while (retries > 0 && !receipt) {
    try {
      receipt = await tx.wait()
      break
    } catch (error: any) {
      if (error.code === -32005 || error.message?.includes('rate limit')) {
        console.warn(`RPC 速率限制，等待 ${delay / 1000} 秒后重试...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
        retries--
        if (retries === 0) {
          return tx.hash
        }
        continue
      }
      throw error
    }
  }

  if (receipt && receipt.status === 0) {
    throw new Error('交易执行失败')
  }

  return receipt?.hash || tx.hash
}

/**
 * Polkadot -> Westend/Frequency 跨链转账
 */
export async function polkadotToWestendFrequencyCrossChainTransfer(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('🔍 Polkadot -> Westend/Frequency 跨链转账:', intent)

  // 验证参数
  if (intent.fromChain !== 'polkadot' || 
      (intent.toChain !== 'westend' && intent.toChain !== 'frequency')) {
    throw new Error('仅支持从 Polkadot Hub TestNet 跨链到 Westend 或 Frequency')
  }

  if (!intent.amount) {
    throw new Error('缺少转账金额')
  }

  // 确保连接到 Polkadot Hub TestNet
  await switchToChain('polkadot')

  // 重新获取 provider 和 signer（切换网络后）
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }
  const newProvider = new ethers.BrowserProvider(window.ethereum)
  const newSigner = await newProvider.getSigner()

  // 获取用户地址和接收地址
  const userAddress = await newSigner.getAddress()
  const recipientAddress = intent.recipient || userAddress

  // 验证接收地址格式
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`接收地址格式不正确: ${recipientAddress}`)
  }

  // 转换金额
  const amount = ethers.parseEther(intent.amount)

  // 检查最小金额
  const minAmount = MIN_AMOUNTS['polkadot']
  if (amount < minAmount) {
    throw new Error(
      `跨链金额太小，最小要求: ${ethers.formatEther(minAmount)} PAS`
    )
  }

  // 检查余额
  const balance = await newProvider.getBalance(userAddress)
  const gasEstimate = BigInt(200000)
  const gasPrice = (await newProvider.getFeeData()).gasPrice || BigInt(10000100000)
  const gasFee = gasEstimate * gasPrice
  const requiredAmount = amount + gasFee

  if (balance < requiredAmount) {
    throw new Error(
      `余额不足。需要: ${ethers.formatEther(requiredAmount)} PAS，当前: ${ethers.formatEther(balance)} PAS`
    )
  }

  // 获取 Gateway 合约地址
  const gatewayAddress = getGateway('polkadot')
  console.log('使用 Polkadot Hub TestNet Gateway 地址:', gatewayAddress)

  // 创建合约实例
  const gatewayContract = new ethers.Contract(
    gatewayAddress,
    GATEWAY_ABI,
    newSigner
  )

  // 检查目标链是否在白名单中
  const destinationChainId = CHAIN_IDS[intent.toChain!]
  const isChainAvailable = await gatewayContract.availableChainIds(destinationChainId)
  if (!isChainAvailable) {
    throw new Error(`${intent.toChain} 链未在 Polkadot Hub TestNet Gateway 白名单中`)
  }

  // 编码接收地址为 bytes（20 字节）
  const addressBytes = ethers.getBytes(recipientAddress)
  const receiverBytes = ethers.hexlify(addressBytes).toLowerCase()

  // 调用 sendDot
  const destinationGasLimit = 90000
  const txGasLimit = 200000

  console.log('调用 sendDot，参数:', {
    destinationChainId,
    destinationAddress: receiverBytes,
    destinationGasLimit,
    amount: intent.amount,
  })

  console.log('⏳ 请在 MetaMask 中确认跨链交易...')
  
  const tx = await Promise.race([
    gatewayContract.sendDot(
      destinationChainId,
      receiverBytes,
      destinationGasLimit,
      {
        value: amount,
        gasLimit: txGasLimit,
      }
    ),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('交易确认超时（5分钟）')), 5 * 60 * 1000)
    )
  ]) as ethers.ContractTransactionResponse

  console.log('✅ 跨链转账交易已发送:', tx.hash)

  // 等待交易确认
  let receipt: ethers.TransactionReceipt | null = null
  let retries = 5
  let delay = 3000

  while (retries > 0 && !receipt) {
    try {
      receipt = await tx.wait()
      break
    } catch (error: any) {
      if (error.code === -32005 || error.message?.includes('rate limit')) {
        console.warn(`RPC 速率限制，等待 ${delay / 1000} 秒后重试...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
        retries--
        if (retries === 0) {
          return tx.hash
        }
        continue
      }
      throw error
    }
  }

  if (receipt && receipt.status === 0) {
    throw new Error('交易执行失败')
  }

  return receipt?.hash || tx.hash
}

/**
 * Polkadot Hub TestNet -> BSC 跨链转账
 */
export async function polkadotCrossChainTransfer(
  intent: Intent,
  provider: ethers.BrowserProvider,
  signer: ethers.JsonRpcSigner
): Promise<string> {
  console.log('🔍 Polkadot Hub TestNet 跨链转账:', intent)

  // 验证参数
  if (intent.fromChain !== 'polkadot' || intent.toChain !== 'bsc') {
    throw new Error('仅支持从 Polkadot Hub TestNet 跨链到 BSC')
  }

  if (!intent.amount) {
    throw new Error('缺少转账金额')
  }

  // 确保连接到 Polkadot Hub TestNet
  await switchToChain('polkadot')

  // 重新获取 provider 和 signer（切换网络后）
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask 未安装')
  }
  const newProvider = new ethers.BrowserProvider(window.ethereum)
  const newSigner = await newProvider.getSigner()

  // 获取用户地址和接收地址
  const userAddress = await newSigner.getAddress()
  const recipientAddress = intent.recipient || userAddress

  // 验证接收地址格式
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`接收地址格式不正确: ${recipientAddress}`)
  }

  // 转换金额
  const amount = ethers.parseEther(intent.amount)

  // 检查最小金额
  const minAmount = MIN_AMOUNTS['polkadot']
  if (amount < minAmount) {
    throw new Error(
      `跨链金额太小，最小要求: 0.23 PAS（BSC 网络费用约 0.22 PAS）`
    )
  }

  // 检查余额
  const balance = await newProvider.getBalance(userAddress)
  const gasEstimate = BigInt(200000)
  const gasPrice = (await newProvider.getFeeData()).gasPrice || BigInt(10000100000)
  const gasFee = gasEstimate * gasPrice
  const requiredAmount = amount + gasFee

  if (balance < requiredAmount) {
    throw new Error(
      `余额不足。需要: ${ethers.formatEther(requiredAmount)} PAS，当前: ${ethers.formatEther(balance)} PAS`
    )
  }

  // 获取 Gateway 合约地址
  const gatewayAddress = getGateway('polkadot')
  console.log('使用 Polkadot Hub TestNet Gateway 地址:', gatewayAddress)

  // 创建合约实例
  const gatewayContract = new ethers.Contract(
    gatewayAddress,
    GATEWAY_ABI,
    newSigner
  )

  // 检查目标链是否在白名单中
  const destinationChainId = CHAIN_IDS['bsc']
  const isChainAvailable = await gatewayContract.availableChainIds(destinationChainId)
  if (!isChainAvailable) {
    throw new Error('BSC 链未在 Polkadot Hub TestNet Gateway 白名单中')
  }

  // 编码接收地址为 bytes（20 字节）
  const addressBytes = ethers.getBytes(recipientAddress)
  const receiverBytes = ethers.hexlify(addressBytes).toLowerCase()

  // 调用 sendZeta
  const destinationGasLimit = 90000
  const txGasLimit = 200000

  console.log('调用 sendDot，参数:', {
    destinationChainId,
    destinationAddress: receiverBytes,
    destinationGasLimit,
    amount: intent.amount,
  })

  console.log('⏳ 请在 MetaMask 中确认跨链交易...')
  
  const tx = await Promise.race([
    gatewayContract.sendDot(
      destinationChainId,
      receiverBytes,
      destinationGasLimit,
      {
        value: amount,
        gasLimit: txGasLimit,
      }
    ),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('交易确认超时（5分钟）')), 5 * 60 * 1000)
    )
  ]) as ethers.ContractTransactionResponse

  console.log('✅ 跨链转账交易已发送:', tx.hash)

  // 等待交易确认
  let receipt: ethers.TransactionReceipt | null = null
  let retries = 5
  let delay = 3000

  while (retries > 0 && !receipt) {
    try {
      receipt = await tx.wait()
      break
    } catch (error: any) {
      if (error.code === -32005 || error.message?.includes('rate limit')) {
        console.warn(`RPC 速率限制，等待 ${delay / 1000} 秒后重试...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
        retries--
        if (retries === 0) {
          return tx.hash
        }
        continue
      }
      throw error
    }
  }

  if (receipt && receipt.status === 0) {
    throw new Error('交易执行失败')
  }

  return receipt?.hash || tx.hash
}
