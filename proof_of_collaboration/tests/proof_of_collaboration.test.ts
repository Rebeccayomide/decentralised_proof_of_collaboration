
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const contractName = "proof_of_collaboration";

describe("Proof of Collaboration - Basic Setup and Initialization", () => {
  beforeEach(() => {
    // Reset simnet state before each test
    simnet.setEpoch("3.0");
  });

  it("ensures simnet is well initialised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  describe("Contract Initialization", () => {
    it("should initialize contract successfully", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "initialize",
        [],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should set contract owner as initial admin", () => {
      // Initialize contract first
      simnet.callPublicFn(contractName, "initialize", [], deployer);
      
      // Check if deployer is admin
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "is-project-admin",
        [Cl.principal(deployer)],
        deployer
      );
      expect(result).toBeBool(true);
    });

    it("should return false for non-admin addresses", () => {
      // Initialize contract first
      simnet.callPublicFn(contractName, "initialize", [], deployer);
      
      // Check if wallet1 is admin (should be false)
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "is-project-admin",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeBool(false);
    });
  });

  describe("Admin Management", () => {
    beforeEach(() => {
      // Initialize contract before each admin test
      simnet.callPublicFn(contractName, "initialize", [], deployer);
    });

    it("should allow contract owner to add new admin", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-project-admin",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify wallet1 is now an admin
      const checkResult = simnet.callReadOnlyFn(
        contractName,
        "is-project-admin",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(checkResult.result).toBeBool(true);
    });

    it("should prevent non-owner from adding admin", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-project-admin",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("should allow multiple admins to be added", () => {
      // Add wallet1 as admin
      simnet.callPublicFn(contractName, "add-project-admin", [Cl.principal(wallet1)], deployer);
      
      // Add wallet2 as admin
      const result2 = simnet.callPublicFn(
        contractName,
        "add-project-admin",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.bool(true));

      // Verify both are admins
      const check1 = simnet.callReadOnlyFn(
        contractName,
        "is-project-admin",
        [Cl.principal(wallet1)],
        deployer
      );
      const check2 = simnet.callReadOnlyFn(
        contractName,
        "is-project-admin",
        [Cl.principal(wallet2)],
        deployer
      );
      
      expect(check1.result).toBeBool(true);
      expect(check2.result).toBeBool(true);
    });
  });

  describe("Read-Only Functions - Initial State", () => {
    beforeEach(() => {
      simnet.callPublicFn(contractName, "initialize", [], deployer);
    });

    it("should return none for non-existent contribution", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contribution",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("should return none for non-existent contributor profile", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("should return error for non-existent contributor tier", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });
  });
});
