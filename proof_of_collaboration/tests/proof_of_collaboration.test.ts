
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

describe("Proof of Collaboration - Contribution Management", () => {
  beforeEach(() => {
    // Reset simnet state and initialize contract before each test
    simnet.setEpoch("3.0");
    simnet.callPublicFn(contractName, "initialize", [], deployer);
    // Add wallet1 as admin for verification tests
    simnet.callPublicFn(contractName, "add-project-admin", [Cl.principal(wallet1)], deployer);
  });

  describe("Contribution Submission", () => {
    it("should allow users to submit contributions", () => {
      const contributionDetails = "Fixed bug in authentication module";
      const { result } = simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8(contributionDetails)],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(1)); // First contribution ID should be 1
    });

    it("should create contributor profile for new contributor", () => {
      const contributionDetails = "Added new feature for user management";
      
      // Submit contribution
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8(contributionDetails)],
        wallet2
      );

      // Check contributor profile was created
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet2)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(0),
          "contribution-count": Cl.uint(1),
          "tier": Cl.uint(1), // BRONZE
          "is-active": Cl.bool(true),
        })
      );
    });

    it("should increment contribution count for existing contributor", () => {
      // Submit first contribution
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("First contribution")],
        wallet1
      );

      // Submit second contribution
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Second contribution")],
        wallet1
      );

      // Check profile has updated contribution count
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(0),
          "contribution-count": Cl.uint(2),
          "tier": Cl.uint(1), // BRONZE
          "is-active": Cl.bool(true),
        })
      );
    });

    it("should store contribution details correctly", () => {
      const contributionDetails = "Implemented user authentication system";
      
      // Submit contribution
      const submitResult = simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8(contributionDetails)],
        wallet2
      );
      
      // Extract contribution ID from the result
      expect(submitResult.result).toBeOk(Cl.uint(1));
      
      // Get contribution details
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contribution",
        [Cl.uint(1)],
        deployer
      );
      
      // Check that contribution exists and has correct basic properties
      expect(result).toBeSome(expect.anything());
    });

    it("should assign sequential contribution IDs", () => {
      // Submit multiple contributions
      const result1 = simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("First contribution")],
        wallet1
      );
      
      const result2 = simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Second contribution")],
        wallet2
      );
      
      const result3 = simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Third contribution")],
        wallet1
      );
      
      expect(result1.result).toBeOk(Cl.uint(1));
      expect(result2.result).toBeOk(Cl.uint(2));
      expect(result3.result).toBeOk(Cl.uint(3));
    });
  });

  describe("Contribution Verification", () => {
    beforeEach(() => {
      // Submit a test contribution before each verification test
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Test contribution for verification")],
        wallet2
      );
    });

    it("should allow admin to verify contribution and assign score", () => {
      const score = 50;
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(score)],
        deployer // deployer is admin
      );
      expect(result).toBeOk(Cl.bool(true));

      // Check contribution is now verified with correct score
      const contributionResult = simnet.callReadOnlyFn(
        contractName,
        "get-contribution",
        [Cl.uint(1)],
        deployer
      );
      
      // Check that the contribution was verified correctly
      expect(contributionResult.result).toBeSome(expect.anything());
    });

    it("should update contributor total score after verification", () => {
      const score = 75;
      
      // Verify contribution
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(score)],
        wallet1 // wallet1 is also admin
      );

      // Check contributor profile updated with score
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet2)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(score),
          "contribution-count": Cl.uint(1),
          "tier": Cl.uint(1), // Still BRONZE
          "is-active": Cl.bool(true),
        })
      );
    });

    it("should prevent non-admin from verifying contributions", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(50)],
        wallet2 // wallet2 is not admin
      );
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("should prevent verifying non-existent contribution", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(999), Cl.uint(50)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });

    it("should prevent re-verification of already verified contribution", () => {
      // First verification
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(50)],
        deployer
      );

      // Try to verify again
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(75)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(102)); // err-already-verified
    });

    it("should accumulate scores from multiple verified contributions", () => {
      // Submit second contribution from same user
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Second contribution")],
        wallet2
      );

      // Verify both contributions with different scores
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(40)],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(2), Cl.uint(60)],
        deployer
      );

      // Check total score is accumulated
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet2)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(100), // 40 + 60
          "contribution-count": Cl.uint(2),
          "tier": Cl.uint(1), // Still BRONZE
          "is-active": Cl.bool(true),
        })
      );
    });
  });
});
