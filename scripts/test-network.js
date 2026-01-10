const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 测试 Polkadot Hub TestNet 网络配置...\n");

  const network = await ethers.provider.getNetwork();
  console.log("当前网络信息:");
  console.log(`  Chain ID: ${network.chainId}`);
  console.log(`  Chain ID (Hex): ${"0x" + network.chainId.toString(16)}`);
  console.log(`  名称: ${network.name || "Unknown"}`);

  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(`  当前区块: ${blockNumber}\n`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("部署者账户信息:");
  console.log(`  地址: ${deployer.address}`);
  console.log(`  余额: ${ethers.formatEther(balance)} PAS\n`);

  if (balance === 0n) {
    console.log("⚠️  警告: 账户余额为 0，请确保账户有足够的 PAS 代币");
  } else {
    console.log("✅ 账户余额充足");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ 网络配置测试完成！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
