export class CheckRequest {
  constructor(fromAddress, candidateHash) {
    this.fromAddress = fromAddress;
    this.candidateHash = candidateHash;
  }
}