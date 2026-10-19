import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { LandRegistry } from "../typechain-types";

const Status = { Pending: 0, Registered: 1, Rejected: 2 } as const;
const ZERO = ethers.ZeroAddress;

/** Deterministic unique doc hash per label. */
function hash(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("LandRegistry", () => {
  let registry: LandRegistry;
  let admin: HardhatEthersSigner;
  let registrar2: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  let REGISTRAR_ROLE: string;
  let ADMIN_ROLE: string;

  beforeEach(async () => {
    [admin, registrar2, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LandRegistry");
    registry = (await Factory.deploy()) as unknown as LandRegistry;
    await registry.waitForDeployment();
    REGISTRAR_ROLE = await registry.REGISTRAR_ROLE();
    ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
  });

  /** Submit a property from `signer` with unique-by-suffix fields. */
  async function submit(
    signer: HardhatEthersSigner,
    suffix: string,
    overrides: Partial<{
      location: string;
      survey: string;
      area: bigint | number;
      type: string;
      cid: string;
      docHash: string;
    }> = {}
  ) {
    const location = overrides.location ?? `Plot ${suffix}, Kochi`;
    const survey = overrides.survey ?? `KL/07/${suffix}`;
    const area = overrides.area ?? 500;
    const type = overrides.type ?? "Residential";
    const cid = overrides.cid ?? `Qm${suffix}`;
    const docHash = overrides.docHash ?? hash(`doc-${suffix}`);
    return registry
      .connect(signer)
      .submitProperty(location, survey, area, type, cid, docHash);
  }

  /** Submit + approve as admin registrar; returns the new id. */
  async function submitAndApprove(signer: HardhatEthersSigner, suffix: string) {
    await submit(signer, suffix);
    const id = await registry.totalProperties();
    await registry.connect(admin).approveProperty(id);
    return id;
  }

  // --------------------------------------------------------------------
  describe("Deployment & roles", () => {
    it("grants admin and registrar roles to the deployer", async () => {
      expect(await registry.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await registry.hasRole(REGISTRAR_ROLE, admin.address)).to.equal(true);
    });

    it("does not grant roles to arbitrary accounts", async () => {
      expect(await registry.hasRole(REGISTRAR_ROLE, alice.address)).to.equal(false);
    });

    it("starts with zero properties and empty stats", async () => {
      expect(await registry.totalProperties()).to.equal(0);
      const [p, r, rej, total] = await registry.getStats();
      expect([p, r, rej, total]).to.deep.equal([0n, 0n, 0n, 0n]);
    });
  });

  // --------------------------------------------------------------------
  describe("submitProperty", () => {
    it("submits a pending property and emits PropertySubmitted", async () => {
      await expect(submit(alice, "1"))
        .to.emit(registry, "PropertySubmitted")
        .withArgs(1n, alice.address, "KL/07/1", hash("doc-1"));

      const p = await registry.getProperty(1);
      expect(p.owner).to.equal(alice.address);
      expect(p.status).to.equal(Status.Pending);
      expect(p.registeredAt).to.equal(0n);
      expect(await registry.totalProperties()).to.equal(1);
      expect(await registry.getPropertiesByOwner(alice.address)).to.deep.equal([1n]);
    });

    it("auto-increments unique ids", async () => {
      await submit(alice, "1");
      await submit(alice, "2");
      expect((await registry.getProperty(2)).id).to.equal(2n);
    });

    it("reverts on each empty string field and zero area", async () => {
      const h = hash("x");
      await expect(
        registry.connect(alice).submitProperty("", "s", 1, "t", "c", h)
      ).to.be.revertedWithCustomError(registry, "EmptyField").withArgs("location");
      await expect(
        registry.connect(alice).submitProperty("l", "", 1, "t", "c", h)
      ).to.be.revertedWithCustomError(registry, "EmptyField").withArgs("surveyNumber");
      await expect(
        registry.connect(alice).submitProperty("l", "s", 1, "", "c", h)
      ).to.be.revertedWithCustomError(registry, "EmptyField").withArgs("propertyType");
      await expect(
        registry.connect(alice).submitProperty("l", "s", 1, "t", "", h)
      ).to.be.revertedWithCustomError(registry, "EmptyField").withArgs("documentCID");
      await expect(
        registry.connect(alice).submitProperty("l", "s", 1, "t", "c", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "EmptyField").withArgs("documentHash");
      await expect(
        registry.connect(alice).submitProperty("l", "s", 0, "t", "c", h)
      ).to.be.revertedWithCustomError(registry, "ZeroArea");
    });

    it("reverts on a duplicate document hash", async () => {
      await submit(alice, "1");
      await expect(
        submit(bob, "2", { docHash: hash("doc-1") })
      ).to.be.revertedWithCustomError(registry, "DuplicateDocumentHash").withArgs(hash("doc-1"));
    });

    it("reverts on a duplicate (survey, location) pair", async () => {
      await submit(alice, "1", { survey: "KL/07/999", location: "Same Plot" });
      await expect(
        submit(bob, "2", { survey: "KL/07/999", location: "Same Plot", docHash: hash("other") })
      ).to.be.revertedWithCustomError(registry, "DuplicateSurveyLocation").withArgs(1n);
    });

    it("allows same survey in a different location", async () => {
      await submit(alice, "1", { survey: "KL/07/100", location: "Location A" });
      await expect(
        submit(bob, "2", { survey: "KL/07/100", location: "Location B", docHash: hash("b") })
      ).to.not.be.reverted;
    });
  });

  // --------------------------------------------------------------------
  describe("approveProperty / rejectProperty", () => {
    it("registrar approves a pending property", async () => {
      await submit(alice, "1");
      await expect(registry.connect(admin).approveProperty(1))
        .to.emit(registry, "PropertyApproved")
        .withArgs(1n, admin.address);
      const p = await registry.getProperty(1);
      expect(p.status).to.equal(Status.Registered);
      expect(p.registeredAt).to.be.greaterThan(0n);
      const [pending, registered] = await registry.getStats();
      expect(pending).to.equal(0n);
      expect(registered).to.equal(1n);
    });

    it("blocks approval by a non-registrar", async () => {
      await submit(alice, "1");
      await expect(
        registry.connect(alice).approveProperty(1)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("reverts approving a non-pending property", async () => {
      await submitAndApprove(alice, "1");
      await expect(
        registry.connect(admin).approveProperty(1)
      ).to.be.revertedWithCustomError(registry, "PropertyNotPending").withArgs(1n, Status.Registered);
    });

    it("reverts approving a non-existent property", async () => {
      await expect(
        registry.connect(admin).approveProperty(99)
      ).to.be.revertedWithCustomError(registry, "PropertyNotFound").withArgs(99n);
    });

    it("registrar rejects a pending property with a reason", async () => {
      await submit(alice, "1");
      await expect(registry.connect(admin).rejectProperty(1, "Forged deed"))
        .to.emit(registry, "PropertyRejected")
        .withArgs(1n, admin.address, "Forged deed");
      const p = await registry.getProperty(1);
      expect(p.status).to.equal(Status.Rejected);
      expect(p.rejectionReason).to.equal("Forged deed");
      const [, , rejected] = await registry.getStats();
      expect(rejected).to.equal(1n);
    });

    it("reverts rejecting with an empty reason", async () => {
      await submit(alice, "1");
      await expect(
        registry.connect(admin).rejectProperty(1, "")
      ).to.be.revertedWithCustomError(registry, "EmptyField").withArgs("reason");
    });

    it("reverts rejecting a non-pending property", async () => {
      await submitAndApprove(alice, "1");
      await expect(
        registry.connect(admin).rejectProperty(1, "late")
      ).to.be.revertedWithCustomError(registry, "PropertyNotPending");
    });
  });

  // --------------------------------------------------------------------
  describe("initiateTransfer", () => {
    it("owner initiates a transfer of a registered property", async () => {
      const id = await submitAndApprove(alice, "1");
      await expect(registry.connect(alice).initiateTransfer(id, bob.address))
        .to.emit(registry, "TransferInitiated")
        .withArgs(id, alice.address, bob.address);
      const pt = await registry.getPendingTransfer(id);
      expect(pt.buyer).to.equal(bob.address);
      expect(pt.active).to.equal(true);
      expect(await registry.getIncomingTransfers(bob.address)).to.deep.equal([id]);
    });

    it("reverts when a non-owner initiates", async () => {
      const id = await submitAndApprove(alice, "1");
      await expect(
        registry.connect(bob).initiateTransfer(id, carol.address)
      ).to.be.revertedWithCustomError(registry, "NotPropertyOwner").withArgs(id, bob.address);
    });

    it("reverts transferring a Pending property", async () => {
      await submit(alice, "1");
      await expect(
        registry.connect(alice).initiateTransfer(1, bob.address)
      ).to.be.revertedWithCustomError(registry, "PropertyNotRegistered").withArgs(1n, Status.Pending);
    });

    it("reverts transferring a Rejected property", async () => {
      await submit(alice, "1");
      await registry.connect(admin).rejectProperty(1, "bad");
      await expect(
        registry.connect(alice).initiateTransfer(1, bob.address)
      ).to.be.revertedWithCustomError(registry, "PropertyNotRegistered").withArgs(1n, Status.Rejected);
    });

    it("reverts on a zero-address buyer", async () => {
      const id = await submitAndApprove(alice, "1");
      await expect(
        registry.connect(alice).initiateTransfer(id, ZERO)
      ).to.be.revertedWithCustomError(registry, "InvalidBuyer").withArgs(ZERO);
    });

    it("reverts on a self-transfer", async () => {
      const id = await submitAndApprove(alice, "1");
      await expect(
        registry.connect(alice).initiateTransfer(id, alice.address)
      ).to.be.revertedWithCustomError(registry, "InvalidBuyer").withArgs(alice.address);
    });

    it("reverts on a second pending transfer", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await expect(
        registry.connect(alice).initiateTransfer(id, carol.address)
      ).to.be.revertedWithCustomError(registry, "TransferAlreadyPending").withArgs(id);
    });
  });

  // --------------------------------------------------------------------
  describe("acceptTransfer", () => {
    it("named buyer accepts, ownership moves, history appended", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await expect(registry.connect(bob).acceptTransfer(id))
        .to.emit(registry, "TransferCompleted")
        .withArgs(id, alice.address, bob.address);

      expect((await registry.getProperty(id)).owner).to.equal(bob.address);
      expect(await registry.getPropertiesByOwner(alice.address)).to.deep.equal([]);
      expect(await registry.getPropertiesByOwner(bob.address)).to.deep.equal([id]);

      const history = await registry.getHistory(id);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(alice.address);
      expect(history[0].to).to.equal(bob.address);

      const pt = await registry.getPendingTransfer(id);
      expect(pt.active).to.equal(false);
      expect(await registry.getIncomingTransfers(bob.address)).to.deep.equal([]);
    });

    it("reverts when a non-designated buyer accepts", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await expect(
        registry.connect(carol).acceptTransfer(id)
      ).to.be.revertedWithCustomError(registry, "NotDesignatedBuyer").withArgs(id, carol.address);
    });

    it("reverts when there is no active pending transfer", async () => {
      const id = await submitAndApprove(alice, "1");
      await expect(
        registry.connect(bob).acceptTransfer(id)
      ).to.be.revertedWithCustomError(registry, "NoActivePendingTransfer").withArgs(id);
    });

    it("keeps history correct across multiple sequential transfers", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await registry.connect(bob).acceptTransfer(id);
      await registry.connect(bob).initiateTransfer(id, carol.address);
      await registry.connect(carol).acceptTransfer(id);

      const history = await registry.getHistory(id);
      expect(history.length).to.equal(2);
      expect(history[0].from).to.equal(alice.address);
      expect(history[0].to).to.equal(bob.address);
      expect(history[1].from).to.equal(bob.address);
      expect(history[1].to).to.equal(carol.address);
      expect((await registry.getProperty(id)).owner).to.equal(carol.address);
    });

    it("maintains the owner index correctly with multiple properties (swap-and-pop)", async () => {
      const id1 = await submitAndApprove(alice, "1");
      const id2 = await submitAndApprove(alice, "2");
      const id3 = await submitAndApprove(alice, "3");
      expect(await registry.getPropertiesByOwner(alice.address)).to.deep.equal([id1, id2, id3]);

      // Transfer the middle one out.
      await registry.connect(alice).initiateTransfer(id2, bob.address);
      await registry.connect(bob).acceptTransfer(id2);

      const remaining = await registry.getPropertiesByOwner(alice.address);
      expect(remaining.map((x) => x.toString()).sort()).to.deep.equal(
        [id1, id3].map((x) => x.toString()).sort()
      );
      expect(await registry.getPropertiesByOwner(bob.address)).to.deep.equal([id2]);
    });
  });

  // --------------------------------------------------------------------
  describe("cancelTransfer", () => {
    it("owner cancels a pending transfer", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await expect(registry.connect(alice).cancelTransfer(id))
        .to.emit(registry, "TransferCancelled")
        .withArgs(id, alice.address);
      expect((await registry.getPendingTransfer(id)).active).to.equal(false);
      expect(await registry.getIncomingTransfers(bob.address)).to.deep.equal([]);
    });

    it("reverts when a non-owner cancels", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await expect(
        registry.connect(bob).cancelTransfer(id)
      ).to.be.revertedWithCustomError(registry, "NotPropertyOwner");
    });

    it("reverts cancelling with no active pending transfer", async () => {
      const id = await submitAndApprove(alice, "1");
      await expect(
        registry.connect(alice).cancelTransfer(id)
      ).to.be.revertedWithCustomError(registry, "NoActivePendingTransfer");
    });

    it("allows re-initiation after a cancel", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await registry.connect(alice).cancelTransfer(id);
      await expect(registry.connect(alice).initiateTransfer(id, carol.address)).to.not.be.reverted;
      expect((await registry.getPendingTransfer(id)).buyer).to.equal(carol.address);
    });
  });

  // --------------------------------------------------------------------
  describe("Document & ownership verification", () => {
    it("verifyDocument returns true on match and false on mismatch", async () => {
      await submit(alice, "1", { docHash: hash("deed-A") });
      expect(await registry.verifyDocument(1, hash("deed-A"))).to.equal(true);
      expect(await registry.verifyDocument(1, hash("tampered"))).to.equal(false);
    });

    it("verifyDocument reverts for a non-existent property", async () => {
      await expect(
        registry.verifyDocument(42, hash("x"))
      ).to.be.revertedWithCustomError(registry, "PropertyNotFound").withArgs(42n);
    });

    it("verifyOwner reflects current ownership", async () => {
      const id = await submitAndApprove(alice, "1");
      expect(await registry.verifyOwner(id, alice.address)).to.equal(true);
      expect(await registry.verifyOwner(id, bob.address)).to.equal(false);
      expect(await registry.verifyOwner(999, alice.address)).to.equal(false);
    });

    it("getProperty reverts for a non-existent id", async () => {
      await expect(registry.getProperty(123))
        .to.be.revertedWithCustomError(registry, "PropertyNotFound")
        .withArgs(123n);
    });

    it("getHistory reverts for a non-existent id", async () => {
      await expect(registry.getHistory(123)).to.be.revertedWithCustomError(
        registry,
        "PropertyNotFound"
      );
    });
  });

  // --------------------------------------------------------------------
  describe("Pagination & stats", () => {
    it("paginates all property ids", async () => {
      for (let i = 1; i <= 5; i++) await submit(alice, String(i));
      const [page1, total] = await registry.getAllPropertyIds(0, 2);
      expect(total).to.equal(5n);
      expect(page1).to.deep.equal([1n, 2n]);
      const [page2] = await registry.getAllPropertyIds(2, 2);
      expect(page2).to.deep.equal([3n, 4n]);
      const [page3] = await registry.getAllPropertyIds(4, 10);
      expect(page3).to.deep.equal([5n]);
      const [empty] = await registry.getAllPropertyIds(10, 10);
      expect(empty).to.deep.equal([]);
    });

    it("tracks stats across the full lifecycle", async () => {
      await submit(alice, "1"); // pending
      await submit(alice, "2"); // pending
      await submit(alice, "3"); // pending
      await registry.connect(admin).approveProperty(1);
      await registry.connect(admin).rejectProperty(2, "dup");
      const [pending, registered, rejected, total] = await registry.getStats();
      expect([pending, registered, rejected, total]).to.deep.equal([1n, 1n, 1n, 3n]);
    });
  });

  // --------------------------------------------------------------------
  describe("Pause (circuit breaker)", () => {
    it("blocks submit / approve / transfer while paused and resumes after unpause", async () => {
      const id = await submitAndApprove(alice, "1");
      await registry.connect(admin).pause();

      await expect(submit(bob, "2")).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(
        registry.connect(alice).initiateTransfer(id, bob.address)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.connect(admin).unpause();
      await expect(registry.connect(alice).initiateTransfer(id, bob.address)).to.not.be.reverted;
    });

    it("only a registrar can pause / unpause", async () => {
      await expect(registry.connect(alice).pause()).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
      await registry.connect(admin).pause();
      await expect(registry.connect(alice).unpause()).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  // --------------------------------------------------------------------
  describe("Role management", () => {
    it("admin grants and revokes REGISTRAR_ROLE and it takes effect", async () => {
      await expect(registry.connect(admin).grantRegistrar(registrar2.address))
        .to.emit(registry, "RegistrarGranted")
        .withArgs(registrar2.address, admin.address);
      await submit(alice, "1");
      await expect(registry.connect(registrar2).approveProperty(1)).to.not.be.reverted;

      await expect(registry.connect(admin).revokeRegistrar(registrar2.address))
        .to.emit(registry, "RegistrarRevoked")
        .withArgs(registrar2.address, admin.address);
      await submit(alice, "2");
      await expect(
        registry.connect(registrar2).approveProperty(2)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("reverts granting registrar to the zero address", async () => {
      await expect(
        registry.connect(admin).grantRegistrar(ZERO)
      ).to.be.revertedWithCustomError(registry, "ZeroAddressAccount");
    });

    it("blocks a non-admin from granting registrar", async () => {
      await expect(
        registry.connect(alice).grantRegistrar(bob.address)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  // --------------------------------------------------------------------
  describe("FlaggedForReview (anti-spam heuristic)", () => {
    it("emits on the 4th submission within 24h from one wallet", async () => {
      await submit(alice, "1");
      await submit(alice, "2");
      await submit(alice, "3");
      expect(await registry.recentSubmissionCount(alice.address)).to.equal(3n);
      await expect(submit(alice, "4"))
        .to.emit(registry, "FlaggedForReview")
        .withArgs(4n, "Wallet exceeded 3 submissions within 24h window (possible bulk spam)");
    });

    it("does not flag when submissions are spread beyond the 24h window", async () => {
      await submit(alice, "1");
      await submit(alice, "2");
      await submit(alice, "3");
      await time.increase(24 * 60 * 60 + 1); // > 24h
      // Window has rolled over; this is the only recent one → no flag.
      await expect(submit(alice, "4")).to.not.emit(registry, "FlaggedForReview");
      expect(await registry.recentSubmissionCount(alice.address)).to.equal(1n);
    });

    it("does not flag different wallets each under the limit", async () => {
      await submit(alice, "1");
      await submit(bob, "2");
      await submit(carol, "3");
      await expect(submit(bob, "4")).to.not.emit(registry, "FlaggedForReview");
    });
  });

  // --------------------------------------------------------------------
  describe("Reentrancy guard", () => {
    it("acceptTransfer carries the nonReentrant guard", async () => {
      // No external calls are made, so a direct reentrancy exploit is not
      // reachable; this test documents the guard and the happy path it wraps.
      const id = await submitAndApprove(alice, "1");
      await registry.connect(alice).initiateTransfer(id, bob.address);
      await expect(registry.connect(bob).acceptTransfer(id)).to.emit(
        registry,
        "TransferCompleted"
      );
    });
  });
});
