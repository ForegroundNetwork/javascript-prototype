import fs from "fs";
import path from "path";
import { calculateHash, generateRandomString } from "../functions/Helpers.js";

import { Block } from "./Block.js";

export class Blockchain {
  constructor(storageDir, miningReward = 50, memoryCacheSize = 100) {
    this.storageDir = storageDir;
    this.miningReward = miningReward;
    this.pendingTransactions = [];
    this.pendingCheckRequests = [];
    this.memoryCacheSize = memoryCacheSize;

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const chainLengthFile = path.join(storageDir, "chain-length.txt");
    if (!fs.existsSync(chainLengthFile)) {
      const genesisBlock = this.createGenesisBlock();
      this.writeBlockToDisk(genesisBlock);
      fs.writeFileSync(chainLengthFile, "1");
      this.chainLength = 1;
    } else {
      this.chainLength = parseInt(fs.readFileSync(chainLengthFile, "utf8"), 10);
    }

    this.blockCache = this.loadRecentBlocksIntoMemory();
  }

  createGenesisBlock() {
    const genesisBlock = new Block(0, Date.now(), [{
      fromAddress: null,
      toAddress: "ERC20BRIDGE",
      amount: 100000000000000000000000000
    }], [], "0");
    genesisBlock.hash = generateRandomString();
    return genesisBlock;
  }

  async addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error("Transaction must include from and to address");
    }

    this.pendingTransactions.push(transaction);
  }

  async addCheckRequest(checkRequest) {
    if (!checkRequest.fromAddress || !checkRequest.candidateHash) {
      throw new Error("Check Request must include from address and candidate hash");
    }

    this.pendingCheckRequests.push(checkRequest);
  }

  async minePendingTransactions(miningRewardAddress) {
    this.pendingTransactions.push({ fromAddress: null, toAddress: miningRewardAddress, amount: this.miningReward });

    const lastBlock = await this.getBlock(this.chainLength - 1);

    const newBlock = new Block(
      this.chainLength,
      Date.now(),
      this.pendingTransactions,
      this.pendingCheckRequests,
      lastBlock.hash
    );

    const dataToHash = this.chainLength
      + Date.now()
      + JSON.stringify(this.pendingTransactions)
      + JSON.stringify(this.pendingCheckRequests)
      + lastBlock.hash;

    newBlock.hash = await calculateHash(dataToHash)

    this.writeBlockToDisk(newBlock);
    this.chainLength++;
    fs.writeFileSync(path.join(this.storageDir, "chain-length.txt"), this.chainLength.toString());

    this.pendingTransactions = [];
    this.pendingCheckRequests = [];
    this.updateMemoryCache(newBlock);
    return newBlock;
  }

  async isChainValid() {
    for (let i = 1; i < this.chainLength; i++) {
      const currentBlock = await this.getBlock(i);
      const previousBlock = await this.getBlock(i - 1);

      if (currentBlock.hash !== await currentBlock.calculateHash()) return false;
      if (currentBlock.previousHash !== previousBlock.hash) return false;
    }
    return true;
  }

  async getBalanceOfAddress(address) {
    let balance = 0;
    for (let i = 0; i < this.chainLength; i++) {
      const block = await this.getBlock(i);
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) balance -= trans.amount;
        if (trans.toAddress === address) balance += trans.amount;
      }
    }
    return balance;
  }

  writeBlockToDisk(block) {
    const blockFile = path.join(this.storageDir, `block-${block.index}.json`);
    fs.writeFileSync(blockFile, JSON.stringify(block, null, 2));
  }

  readBlockFromDisk(index) {
    const blockFile = path.join(this.storageDir, `block-${index}.json`);
    if (!fs.existsSync(blockFile)) {
      throw new Error(`Block file not found: block-${index}.json`);
    }
    const data = JSON.parse(fs.readFileSync(blockFile, "utf8"));
    return new Block(data.index, data.timestamp, data.transactions, data.requests, data.previousHash, data.hash);
  }

  async getBlock(index) {
    const cached = this.blockCache.find(b => b.index === index);
    if (cached) return cached;

    const block = this.readBlockFromDisk(index);
    return block;
  }

  loadRecentBlocksIntoMemory() {
    const start = Math.max(0, this.chainLength - this.memoryCacheSize);
    const blocks = [];
    for (let i = start; i < this.chainLength; i++) {
      blocks.push(this.readBlockFromDisk(i));
    }
    return blocks;
  }

  updateMemoryCache(newBlock) {
    this.blockCache.push(newBlock);
    if (this.blockCache.length > this.memoryCacheSize) {
      this.blockCache.shift();
    }
  }
}