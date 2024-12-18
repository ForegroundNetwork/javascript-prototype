export class Block {
  constructor(index, timestamp, transactions, requests, previousHash = "", hash = "") {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions || [];
    this.requests = requests || [];
    this.previousHash = previousHash || "";
    this.hash = hash || "";
  }
}