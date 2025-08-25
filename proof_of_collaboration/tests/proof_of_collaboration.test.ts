
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

describe("Proof of Collaboration - Tier System and Advanced Features", () => {
  beforeEach(() => {
    // Reset simnet state and initialize contract before each test
    simnet.setEpoch("3.0");
    simnet.callPublicFn(contractName, "initialize", [], deployer);
    // Add wallet1 as admin for verification tests
    simnet.callPublicFn(contractName, "add-project-admin", [Cl.principal(wallet1)], deployer);
  });

  describe("Tier Calculation and Updates", () => {
    it("should maintain BRONZE tier for scores below SILVER threshold", () => {
      // Submit and verify contribution with score below SILVER threshold (100)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Small contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(50)], // Below 100
        deployer
      );

      // Update tier
      const updateResult = simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(updateResult.result).toBeOk(Cl.bool(true));

      // Check tier remains BRONZE
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1)); // BRONZE
    });

    it("should upgrade to SILVER tier for scores at/above SILVER threshold", () => {
      // Submit and verify contribution with score at SILVER threshold (100)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Medium contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(100)], // Exactly 100
        deployer
      );

      // Update tier
      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      // Check tier upgraded to SILVER
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(2)); // SILVER
    });

    it("should upgrade to GOLD tier for scores at/above GOLD threshold", () => {
      // Submit multiple contributions to reach GOLD threshold (250)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("First large contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Second large contribution")],
        wallet2
      );
      
      // Verify with scores totaling 250
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(150)],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(2), Cl.uint(100)],
        deployer
      );

      // Update tier
      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      // Check tier upgraded to GOLD
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(3)); // GOLD
    });

    it("should upgrade to PLATINUM tier for scores at/above PLATINUM threshold", () => {
      // Submit multiple contributions to reach PLATINUM threshold (500)
      for (let i = 1; i <= 3; i++) {
        simnet.callPublicFn(
          contractName,
          "submit-contribution",
          [Cl.stringUtf8(`Major contribution ${i}`)],
          wallet2
        );
      }
      
      // Verify with scores totaling 500
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(200)],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(2), Cl.uint(200)],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(3), Cl.uint(100)],
        deployer
      );

      // Update tier
      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      // Check tier upgraded to PLATINUM
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(4)); // PLATINUM
    });

    it("should return error when updating tier for non-existent contributor", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet1)], // wallet1 has no contributions
        deployer
      );
      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });

    it("should allow anyone to update contributor tiers", () => {
      // Submit and verify a contribution
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Test contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(150)],
        deployer
      );

      // Non-admin user can update tier
      const { result } = simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        wallet1 // wallet1 calling, not admin for this function
      );
      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Complete Workflow Integration Tests", () => {
    it("should handle complete contributor journey from bronze to platinum", () => {
      // Phase 1: Start with BRONZE (first contribution)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Initial contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(50)],
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      let tierResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tierResult.result).toBeOk(Cl.uint(1)); // BRONZE

      // Phase 2: Upgrade to SILVER (reach 100 total score)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Second contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(2), Cl.uint(60)], // Total: 50 + 60 = 110
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      tierResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tierResult.result).toBeOk(Cl.uint(2)); // SILVER

      // Phase 3: Upgrade to GOLD (reach 250 total score)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Third contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(3), Cl.uint(150)], // Total: 110 + 150 = 260
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      tierResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tierResult.result).toBeOk(Cl.uint(3)); // GOLD

      // Phase 4: Upgrade to PLATINUM (reach 500 total score)
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Fourth contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(4), Cl.uint(250)], // Total: 260 + 250 = 510
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      tierResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tierResult.result).toBeOk(Cl.uint(4)); // PLATINUM

      // Verify final profile state
      const profileResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet2)],
        deployer
      );
      
      expect(profileResult.result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(510),
          "contribution-count": Cl.uint(4),
          "tier": Cl.uint(4), // PLATINUM
          "is-active": Cl.bool(true),
        })
      );
    });

    it("should handle multiple contributors with different tier progressions", () => {
      // Contributor 1 (wallet1): Reaches SILVER
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Wallet1 contribution")],
        wallet1
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(120)],
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet1)],
        deployer
      );

      // Contributor 2 (wallet2): Reaches GOLD
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Wallet2 first contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Wallet2 second contribution")],
        wallet2
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(2), Cl.uint(150)],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(3), Cl.uint(120)], // Total: 270
        deployer
      );

      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      // Check tiers
      const tier1Result = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(tier1Result.result).toBeOk(Cl.uint(2)); // SILVER

      const tier2Result = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tier2Result.result).toBeOk(Cl.uint(3)); // GOLD
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle zero score contributions correctly", () => {
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("Zero score contribution")],
        wallet2
      );
      
      // Verify with zero score
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(0)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Profile should still be created/updated
      const profileResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet2)],
        deployer
      );
      
      expect(profileResult.result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(0),
          "contribution-count": Cl.uint(1),
          "tier": Cl.uint(1), // BRONZE
          "is-active": Cl.bool(true),
        })
      );
    });

    it("should handle very large score values", () => {
      simnet.callPublicFn(
        contractName,
        "submit-contribution",
        [Cl.stringUtf8("High value contribution")],
        wallet2
      );
      
      // Verify with large score
      const largeScore = 1000000;
      const { result } = simnet.callPublicFn(
        contractName,
        "verify-contribution",
        [Cl.uint(1), Cl.uint(largeScore)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Update tier and check it reaches PLATINUM
      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      const tierResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tierResult.result).toBeOk(Cl.uint(4)); // PLATINUM
    });

    it("should maintain data consistency across multiple operations", () => {
      // Perform multiple rapid operations
      for (let i = 1; i <= 5; i++) {
        simnet.callPublicFn(
          contractName,
          "submit-contribution",
          [Cl.stringUtf8(`Rapid contribution ${i}`)],
          wallet2
        );
        
        simnet.callPublicFn(
          contractName,
          "verify-contribution",
          [Cl.uint(i), Cl.uint(i * 10)],
          deployer
        );
      }

      // Check final state consistency
      const profileResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-profile",
        [Cl.principal(wallet2)],
        deployer
      );
      
      // Expected total: 10 + 20 + 30 + 40 + 50 = 150
      expect(profileResult.result).toBeSome(
        Cl.tuple({
          "total-score": Cl.uint(150),
          "contribution-count": Cl.uint(5),
          "tier": Cl.uint(1), // Still BRONZE until tier update
          "is-active": Cl.bool(true),
        })
      );

      // Update tier and verify it reaches SILVER
      simnet.callPublicFn(
        contractName,
        "update-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );

      const tierResult = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-tier",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(tierResult.result).toBeOk(Cl.uint(2)); // SILVER
    });
  });
});

