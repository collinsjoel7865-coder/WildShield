import { describe, it, expect, beforeEach } from "vitest";

type MockContract = {
  admin: string;
  paused: boolean;
  totalSupply: bigint;
  treasury: string;
  balances: Map<string, bigint>;
  stakedBalances: Map<string, bigint>;
  allowances: Map<string, Map<string, bigint>>;
  donationHistory: Map<string, bigint>;
  MAX_SUPPLY: bigint;

  isAdmin: (caller: string) => boolean;
  ensureNotPaused: () => { error: number } | undefined;
  setPaused: (caller: string, pause: boolean) => { value: boolean } | { error: number };
  setTreasury: (caller: string, newTreasury: string) => { value: true } | { error: number };
  mint: (caller: string, recipient: string, amount: bigint) => { value: true } | { error: number };
  burn: (caller: string, amount: bigint) => { value: true } | { error: number };
  transfer: (caller: string, recipient: string, amount: bigint) => { value: true } | { error: number };
  approve: (caller: string, spender: string, amount: bigint) => { value: true } | { error: number };
  transferFrom: (caller: string, sender: string, recipient: string, amount: bigint) => { value: true } | { error: number };
  stake: (caller: string, amount: bigint) => { value: true } | { error: number };
  unstake: (caller: string, amount: bigint) => { value: true } | { error: number };
  donate: (caller: string, amount: bigint) => { value: true } | { error: number };
};

const createMockContract = (): MockContract => ({
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalSupply: 0n,
  treasury: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  balances: new Map<string, bigint>(),
  stakedBalances: new Map<string, bigint>(),
  allowances: new Map<string, Map<string, bigint>>(),
  donationHistory: new Map<string, bigint>(),
  MAX_SUPPLY: 1000000000000000n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  ensureNotPaused() {
    if (this.paused) return { error: 104 };
    return undefined;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  setTreasury(caller: string, newTreasury: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newTreasury === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.treasury = newTreasury;
    return { value: true };
  },

  mint(caller: string, recipient: string, amount: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    if (this.totalSupply + amount > this.MAX_SUPPLY) return { error: 103 };
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.totalSupply += amount;
    return { value: true };
  },

  burn(caller: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (amount <= 0n) return { error: 107 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.totalSupply -= amount;
    return { value: true };
  },

  transfer(caller: string, recipient: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    return { value: true };
  },

  approve(caller: string, spender: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (spender === "SP000000000000000000002Q6VF78") return { error: 105 };
    let ownerAllowances = this.allowances.get(caller);
    if (!ownerAllowances) {
      ownerAllowances = new Map<string, bigint>();
      this.allowances.set(caller, ownerAllowances);
    }
    ownerAllowances.set(spender, amount);
    return { value: true };
  },

  transferFrom(caller: string, sender: string, recipient: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    const senderBal = this.balances.get(sender) || 0n;
    if (senderBal < amount) return { error: 101 };
    const ownerAllowances = this.allowances.get(sender);
    const allowance = ownerAllowances ? ownerAllowances.get(caller) || 0n : 0n;
    if (allowance < amount) return { error: 106 };
    this.balances.set(sender, senderBal - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    if (ownerAllowances) {
      ownerAllowances.set(caller, allowance - amount);
    }
    return { value: true };
  },

  stake(caller: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (amount <= 0n) return { error: 107 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.stakedBalances.set(caller, (this.stakedBalances.get(caller) || 0n) + amount);
    return { value: true };
  },

  unstake(caller: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (amount <= 0n) return { error: 107 };
    const stakeBal = this.stakedBalances.get(caller) || 0n;
    if (stakeBal < amount) return { error: 102 };
    this.stakedBalances.set(caller, stakeBal - amount);
    this.balances.set(caller, (this.balances.get(caller) || 0n) + amount);
    return { value: true };
  },

  donate(caller: string, amount: bigint) {
    const pausedErr = this.ensureNotPaused();
    if (pausedErr) return pausedErr;
    if (amount <= 0n) return { error: 107 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.balances.set(this.treasury, (this.balances.get(this.treasury) || 0n) + amount);
    this.donationHistory.set(caller, (this.donationHistory.get(caller) || 0n) + amount);
    return { value: true };
  },
});

describe("WildShield Conservation Token", () => {
  let mockContract: MockContract;

  beforeEach(() => {
    mockContract = createMockContract();
  });

  it("should mint tokens when called by admin", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 1000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(1000n);
    expect(mockContract.totalSupply).toBe(1000n);
  });

  it("should prevent minting over max supply", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 2000000000000000n);
    expect(result).toEqual({ error: 103 });
  });

  it("should prevent non-admin from minting", () => {
    const result = mockContract.mint("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", 100n);
    expect(result).toEqual({ error: 100 });
  });

  it("should burn tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    const result = mockContract.burn("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(300n);
    expect(mockContract.totalSupply).toBe(300n);
  });

  it("should transfer tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    const result = mockContract.transfer("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(300n);
    expect(mockContract.balances.get("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP")).toBe(200n);
  });

  it("should approve and transfer from using allowance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    const approveResult = mockContract.approve("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", 300n);
    expect(approveResult).toEqual({ value: true });
    const transferFromResult = mockContract.transferFrom("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST4HASBSFK928FQ2K1KAX58HSDGKV5N7R21XDQPW", 200n);
    expect(transferFromResult).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(300n);
    expect(mockContract.balances.get("ST4HASBSFK928FQ2K1KAX58HSDGKV5N7R21XDQPW")).toBe(200n);
    const remainingAllowance = mockContract.allowances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")?.get("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP") || 0n;
    expect(remainingAllowance).toBe(100n);
  });

  it("should prevent transfer from with insufficient allowance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    mockContract.approve("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", 100n);
    const result = mockContract.transferFrom("ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST4HASBSFK928FQ2K1KAX58HSDGKV5N7R21XDQPW", 200n);
    expect(result).toEqual({ error: 106 });
  });

  it("should stake tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    const result = mockContract.stake("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(300n);
    expect(mockContract.stakedBalances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(200n);
  });

  it("should unstake tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    mockContract.stake("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 200n);
    const result = mockContract.unstake("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 100n);
    expect(result).toEqual({ value: true });
    expect(mockContract.stakedBalances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(100n);
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(400n);
  });

  it("should donate tokens to treasury", () => {
    mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 500n);
    const result = mockContract.donate("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(300n);
    expect(mockContract.balances.get(mockContract.treasury)).toBe(200n);
    expect(mockContract.donationHistory.get("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM")).toBe(200n);
  });

  it("should not allow operations when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const transferResult = mockContract.transfer("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", 10n);
    expect(transferResult).toEqual({ error: 104 });
    const stakeResult = mockContract.stake("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 10n);
    expect(stakeResult).toEqual({ error: 104 });
    const donateResult = mockContract.donate("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 10n);
    expect(donateResult).toEqual({ error: 104 });
  });

  it("should set new treasury by admin", () => {
    const newTreasury = "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP";
    const result = mockContract.setTreasury(mockContract.admin, newTreasury);
    expect(result).toEqual({ value: true });
    expect(mockContract.treasury).toBe(newTreasury);
  });

  it("should prevent invalid amounts", () => {
    const mintResult = mockContract.mint(mockContract.admin, "ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", 0n);
    expect(mintResult).toEqual({ error: 107 });
    const transferResult = mockContract.transfer("ST2CY5V39NHDP5PWEYNE3GT6RFRVRXTLKQNEZX2DM", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP", 0n);
    expect(transferResult).toEqual({ error: 107 });
  });
});