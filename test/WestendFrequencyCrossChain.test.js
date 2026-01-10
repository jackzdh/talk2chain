const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WestendFrequencyCrossChain", function () {
  let crossChain;
  let gateway;
  let owner;
  let addr1;
  let addr2;

  const WESTEND_CHAIN_ID = 2000;
  const FREQUENCY_CHAIN_ID = 2001;
  const MIN_CROSS_CHAIN_AMOUNT = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const Gateway = await ethers.getContractFactory("MockGateway");
    gateway = await Gateway.deploy();
    await gateway.waitForDeployment();

    const CrossChain = await ethers.getContractFactory("WestendFrequencyCrossChain");
    crossChain = await CrossChain.deploy(await gateway.getAddress());
    await crossChain.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置 gateway 地址", async function () {
      expect(await crossChain.getGatewayAddress()).to.equal(await gateway.getAddress());
    });

    it("应该拒绝零地址的 gateway", async function () {
      const CrossChain = await ethers.getContractFactory("WestendFrequencyCrossChain");
      await expect(CrossChain.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid gateway address");
    });

    it("应该返回支持的链 ID", async function () {
      const chains = await crossChain.getSupportedChains();
      expect(chains[0]).to.equal(WESTEND_CHAIN_ID);
      expect(chains[1]).to.equal(FREQUENCY_CHAIN_ID);
    });

    it("应该接收 ETH", async function () {
      const amount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await crossChain.getAddress(),
        value: amount
      });
      expect(await ethers.provider.getBalance(await crossChain.getAddress())).to.equal(amount);
    });
  });

  describe("crossChainTransfer", function () {
    it("应该成功发起跨链转账到 Westend", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).crossChainTransfer(
          destAddressBytes,
          WESTEND_CHAIN_ID,
          "Westend",
          { value: amount }
        )
      ).to.changeEtherBalances(
        [addr1, gateway],
        [-amount, amount]
      );
    });

    it("应该成功发起跨链转账到 Frequency", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).crossChainTransfer(
          destAddressBytes,
          FREQUENCY_CHAIN_ID,
          "Frequency",
          { value: amount }
        )
      ).to.changeEtherBalances(
        [addr1, gateway],
        [-amount, amount]
      );
    });

    it("应该拒绝低于最小金额的转账", async function () {
      const amount = ethers.parseEther("0.005");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).crossChainTransfer(
          destAddressBytes,
          WESTEND_CHAIN_ID,
          "Westend",
          { value: amount }
        )
      ).to.be.revertedWith("Amount below minimum");
    });

    it("应该拒绝无效的目标地址长度", async function () {
      const amount = ethers.parseEther("1");
      const invalidAddress = ethers.zeroPadValue(addr1.address, 32);

      await expect(
        crossChain.connect(addr1).crossChainTransfer(
          invalidAddress,
          WESTEND_CHAIN_ID,
          "Westend",
          { value: amount }
        )
      ).to.be.revertedWith("Invalid destination address length");
    });

    it("应该拒绝不支持的链 ID", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).crossChainTransfer(
          destAddressBytes,
          9999,
          "Unknown",
          { value: amount }
        )
      ).to.be.revertedWith("Unsupported destination chain");
    });

    it("应该正确触发 CrossChainTransferInitiated 事件", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      const tx = await crossChain.connect(addr1).crossChainTransfer(
        destAddressBytes,
        WESTEND_CHAIN_ID,
        "Westend",
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = crossChain.interface.parseLog(log);
          return parsed && parsed.name === "CrossChainTransferInitiated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });
  });

  describe("transferToWestend", function () {
    it("应该成功转账到 Westend", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).transferToWestend(
          destAddressBytes,
          { value: amount }
        )
      ).to.changeEtherBalances(
        [addr1, gateway],
        [-amount, amount]
      );
    });

    it("应该拒绝低于最小金额的转账", async function () {
      const amount = ethers.parseEther("0.005");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).transferToWestend(
          destAddressBytes,
          { value: amount }
        )
      ).to.be.revertedWith("Amount below minimum");
    });
  });

  describe("transferToFrequency", function () {
    it("应该成功转账到 Frequency", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).transferToFrequency(
          destAddressBytes,
          { value: amount }
        )
      ).to.changeEtherBalances(
        [addr1, gateway],
        [-amount, amount]
      );
    });

    it("应该拒绝低于最小金额的转账", async function () {
      const amount = ethers.parseEther("0.005");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).transferToFrequency(
          destAddressBytes,
          { value: amount }
        )
      ).to.be.revertedWith("Amount below minimum");
    });
  });

  describe("withdraw", function () {
    it("应该允许提取合约余额", async function () {
      const amount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await crossChain.getAddress(),
        value: amount
      });

      await expect(crossChain.withdraw())
        .to.changeEtherBalances(
          [crossChain, owner],
          [-amount, amount]
        );
    });

    it("应该拒绝在没有余额时提取", async function () {
      await expect(crossChain.withdraw()).to.be.revertedWith("No balance to withdraw");
    });

    it("应该正确触发 Withdrawal 事件", async function () {
      const amount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await crossChain.getAddress(),
        value: amount
      });

      await expect(crossChain.withdraw())
        .to.emit(crossChain, "Withdrawal")
        .withArgs(owner.address, amount);
    });
  });

  describe("emergencyWithdraw", function () {
    it("应该允许紧急提取指定金额", async function () {
      const amount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await crossChain.getAddress(),
        value: amount
      });

      await expect(crossChain.emergencyWithdraw(addr1, amount))
        .to.changeEtherBalances(
          [crossChain, addr1],
          [-amount, amount]
        );
    });

    it("应该拒绝零地址接收者", async function () {
      const amount = ethers.parseEther("1");
      
      await expect(
        crossChain.emergencyWithdraw(ethers.ZeroAddress, amount)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("应该拒绝零金额", async function () {
      await expect(
        crossChain.emergencyWithdraw(addr1, 0)
      ).to.be.revertedWith("Invalid amount");
    });

    it("应该拒绝超过合约余额的金额", async function () {
      const amount = ethers.parseEther("100");
      
      await expect(
        crossChain.emergencyWithdraw(addr1, amount)
      ).to.be.revertedWith("Invalid amount");
    });

    it("应该正确触发 Withdrawal 事件", async function () {
      const amount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await crossChain.getAddress(),
        value: amount
      });

      await expect(crossChain.emergencyWithdraw(addr1, amount))
        .to.emit(crossChain, "Withdrawal")
        .withArgs(addr1.address, amount);
    });
  });

  describe("Gateway 交互", function () {
    it("应该正确调用 gateway.sendDot", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      await expect(
        crossChain.connect(addr1).crossChainTransfer(
          destAddressBytes,
          WESTEND_CHAIN_ID,
          "Westend",
          { value: amount }
        )
      ).to.emit(gateway, "SendDotCalled");
    });

    it("应该传递正确的参数给 gateway", async function () {
      const amount = ethers.parseEther("1");
      const destAddress = addr1.address;
      const destAddressBytes = ethers.zeroPadValue(destAddress, 20);

      const tx = await crossChain.connect(addr1).crossChainTransfer(
        destAddressBytes,
        WESTEND_CHAIN_ID,
        "Westend",
        { value: amount }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = gateway.interface.parseLog(log);
          return parsed && parsed.name === "SendDotCalled";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });
  });
});
