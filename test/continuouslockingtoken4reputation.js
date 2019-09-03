const helpers = require('./helpers');
const DaoCreator = artifacts.require("./DaoCreator.sol");
const ControllerCreator = artifacts.require("./ControllerCreator.sol");
const constants = require('./constants');
const ERC20Mock = artifacts.require('./test/ERC20Mock.sol');
var ContinuousLocking4Reputation = artifacts.require("./ContinuousLocking4Reputation.sol");


const setup = async function (accounts,
                             _initialize = true,
                             _reputationReward = 850000,
                             _startTime = 0,
                             _periodsUnit = (30*60*60),
                             _redeemEnableTime = (30*60*60),
                             _maxLockingPeriod = 12,
                             _repRewardConstA = 85000,
                             _repRewardConstB = 900,
                             _agreementHash = helpers.SOME_HASH
                           ) {
   var testSetup = new helpers.TestSetup();
   testSetup.lockingToken = await ERC20Mock.new(accounts[0], web3.utils.toWei('100', "ether"));
   var controllerCreator = await ControllerCreator.new({gas: constants.ARC_GAS_LIMIT});
   testSetup.daoCreator = await DaoCreator.new(controllerCreator.address,{gas:constants.ARC_GAS_LIMIT});

   testSetup.org = await helpers.setupOrganization(testSetup.daoCreator,accounts[0],1000,1000);
   testSetup.startTime = (await web3.eth.getBlock("latest")).timestamp + _startTime;
   testSetup.redeemEnableTime = (await web3.eth.getBlock("latest")).timestamp + _redeemEnableTime;
   testSetup.continuousLocking4Reputation = await ContinuousLocking4Reputation.new();
   testSetup.periodsUnit = _periodsUnit;
   testSetup.agreementHash = _agreementHash;
   testSetup.maxLockingPeriod = _maxLockingPeriod;

   testSetup.repRewardConstA = _repRewardConstA;
   testSetup.repRewardConstB = _repRewardConstB;
   testSetup.reputationReward = _reputationReward;
   if (_initialize === true ) {
     await testSetup.continuousLocking4Reputation.initialize(testSetup.org.avatar.address,
                                                     testSetup.reputationReward,
                                                     testSetup.startTime,
                                                     testSetup.periodsUnit,
                                                     testSetup.redeemEnableTime,
                                                     testSetup.maxLockingPeriod,
                                                     testSetup.repRewardConstA,
                                                     testSetup.repRewardConstB,
                                                     testSetup.lockingToken.address,
                                                     testSetup.agreementHash,
                                                     {gas : constants.ARC_GAS_LIMIT});
   }

   var permissions = "0x00000000";
   await testSetup.daoCreator.setSchemes(testSetup.org.avatar.address,[testSetup.continuousLocking4Reputation.address],[web3.utils.asciiToHex("0")],[permissions],"metaData");
   await testSetup.lockingToken.approve(testSetup.continuousLocking4Reputation.address,web3.utils.toWei('100', "ether"));
   return testSetup;
};

contract('ContinuousLocking4Reputation', accounts => {
    it("initialize", async () => {
      let testSetup = await setup(accounts);
      assert.equal(await testSetup.continuousLocking4Reputation.reputationRewardLeft(),testSetup.reputationReward);
      assert.equal(await testSetup.continuousLocking4Reputation.startTime(),testSetup.startTime);
      assert.equal(await testSetup.continuousLocking4Reputation.redeemEnableTime(),testSetup.redeemEnableTime);
      assert.equal(await testSetup.continuousLocking4Reputation.token(),testSetup.lockingToken.address);
      assert.equal(await testSetup.continuousLocking4Reputation.periodsUnit(),testSetup.periodsUnit);
      assert.equal(await testSetup.continuousLocking4Reputation.getAgreementHash(),testSetup.agreementHash);
    });

    it("initialize periodsUnit <= 15 seconds  is not allowed", async () => {
      let testSetup = await setup(accounts,false);
      try {
        await testSetup.continuousLocking4Reputation.initialize(testSetup.org.avatar.address,
                                                        testSetup.reputationReward,
                                                        testSetup.startTime,
                                                        1,
                                                        testSetup.redeemEnableTime,
                                                        testSetup.maxLockingPeriod,
                                                        testSetup.repRewardConstA,
                                                        testSetup.repRewardConstB,
                                                        testSetup.lockingToken.address,
                                                        testSetup.agreementHash,
                                                        {gas : constants.ARC_GAS_LIMIT});
        assert(false, "periodsUnit < 15  is not allowed");
      } catch(error) {
        helpers.assertVMException(error);
      }
    });

    it("initialize _redeemEnableTime < _startTime+_periodsUnit is not allowed", async () => {
      let testSetup = await setup(accounts,false);
      try {
        await testSetup.continuousLocking4Reputation.initialize(testSetup.org.avatar.address,
                                                        testSetup.reputationReward,
                                                        testSetup.startTime,
                                                        testSetup.periodsUnit,
                                                        testSetup.startTime + testSetup.periodsUnit -7,
                                                        testSetup.maxLockingPeriod,
                                                        testSetup.repRewardConstA,
                                                        testSetup.repRewardConstB,
                                                        testSetup.lockingToken.address,
                                                        testSetup.agreementHash,
                                                        {gas : constants.ARC_GAS_LIMIT});
        assert(false, "_redeemEnableTime < _startTime+_periodsUnit  is not allowed");
      } catch(error) {
        helpers.assertVMException(error);
      }
    });


    it("lock", async () => {
      let testSetup = await setup(accounts);
      var tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"), 12 , 0, testSetup.agreementHash);
      var id = await helpers.getValueFromLogs(tx, '_lockingId',1);
      assert.equal(tx.logs.length,1);
      assert.equal(tx.logs[0].event,"LockToken");
      assert.equal(tx.logs[0].args._lockingId,id);
      assert.equal(tx.logs[0].args._amount,web3.utils.toWei('1', "ether"));
      assert.equal(tx.logs[0].args._locker,accounts[0]);
      //test the tokens moved to the wallet.
      assert.equal(await testSetup.lockingToken.balanceOf(testSetup.continuousLocking4Reputation.address),web3.utils.toWei('1', "ether"));
    });


    it("lock without initialize should fail", async () => {
      let testSetup = await setup(accounts,false);
      try {
        await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,0, testSetup.agreementHash);
        assert(false, "lock without initialize should fail");
      } catch(error) {
        helpers.assertVMException(error);
      }
    });

    it("lock with wrong agreementHash should fail", async () => {
      let testSetup = await setup(accounts);
      try {
        await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,0, helpers.NULL_HASH);
        assert(false, "lock with wrong agreementHash should fail");
      } catch(error) {
        helpers.assertVMException(error);
      }
    });

    it("lock with value == 0 should revert", async () => {
      let testSetup = await setup(accounts);
      try {
        await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('0', "ether"),1,0,testSetup.agreementHash);
        assert(false, "lock with value == 0 should revert");
      } catch(error) {
        helpers.assertVMException(error);
      }
    });

    it("lock with period over maxLockingPeriod should revert", async () => {
      let testSetup = await setup(accounts);
      try {
        await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('0', "ether"),testSetup.maxLockingPeriod +1 ,0,testSetup.agreementHash);
        assert(false, "lock with period over maxLockingPeriod should revert");
      } catch(error) {
        helpers.assertVMException(error);
      }
    });

    it("redeem", async () => {
        let testSetup = await setup(accounts);
        var period = 12;
        var tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),period,0,testSetup.agreementHash);
        var id = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await helpers.increaseTime(testSetup.periodsUnit * period +1);
        tx = await testSetup.continuousLocking4Reputation.redeem(accounts[0],id);
        var redeemAmount = 0;
        for (var lockingPeriodToRedeemFrom = 0; lockingPeriodToRedeemFrom < period; lockingPeriodToRedeemFrom++) {
            redeemAmount += testSetup.repRewardConstA * (Math.pow((testSetup.repRewardConstB/1000),lockingPeriodToRedeemFrom));
        }
        redeemAmount = Math.floor(redeemAmount);
        assert.equal(tx.logs.length,1);
        assert.equal(tx.logs[0].event,"Redeem");
        assert.equal(tx.logs[0].args._amount.toNumber(),redeemAmount);
        assert.equal(tx.logs[0].args._beneficiary,accounts[0]);
        assert.equal(await testSetup.org.reputation.balanceOf(accounts[0]),1000+redeemAmount);
    });

    it("redeem score ", async () => {
        let testSetup = await setup(accounts);
        var tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,0,testSetup.agreementHash,{from:accounts[0]});
        var id1 = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await testSetup.lockingToken.transfer(accounts[1],web3.utils.toWei('3', "ether"));
        await testSetup.lockingToken.approve(testSetup.continuousLocking4Reputation.address,web3.utils.toWei('100', "ether"),{from:accounts[1]});
        tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('3', "ether"),1,0,testSetup.agreementHash,{from:accounts[1]});
        var id2 = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await helpers.increaseTime(testSetup.periodsUnit  +1);
        await testSetup.continuousLocking4Reputation.redeem(accounts[0],id1);
        await testSetup.continuousLocking4Reputation.redeem(accounts[1],id2);
        assert.equal(await testSetup.org.reputation.balanceOf(accounts[0]),1000+85000/4);
        assert.equal(await testSetup.org.reputation.balanceOf(accounts[1]),85000*3/4);
    });

    it("redeem cannot redeem twice", async () => {
        let testSetup = await setup(accounts);
        var tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,0,testSetup.agreementHash);
        var id = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await helpers.increaseTime(testSetup.periodsUnit  +1);
        await testSetup.continuousLocking4Reputation.redeem(accounts[0],id);
        try {
          await testSetup.continuousLocking4Reputation.redeem(accounts[0],id);
          assert(false, "cannot redeem twice");
        } catch(error) {
          helpers.assertVMException(error);
        }
    });

    it("redeem before redeemEnableTime should revert", async () => {
        let testSetup = await setup(accounts);
        var tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,0,testSetup.agreementHash);
        var id = await helpers.getValueFromLogs(tx, '_lockingId',1);

        try {
             await testSetup.continuousLocking4Reputation.redeem(accounts[0],id);
             assert(false, "redeem before redeemEnableTime should revert");
           } catch(error) {
             helpers.assertVMException(error);
           }
        await helpers.increaseTime(testSetup.redeemEnableTime);
        await testSetup.continuousLocking4Reputation.redeem(accounts[0],id);
    });

    it("lock and redeem from all lockings", async () => {
        let testSetup = await setup(accounts);
        var tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,0,testSetup.agreementHash);
        var id1 = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await helpers.increaseTime(testSetup.periodsUnit+1);
        tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,1,testSetup.agreementHash);
        var id2 = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await helpers.increaseTime(testSetup.periodsUnit+1);
        tx = await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,2,testSetup.agreementHash);
        var id3 = await helpers.getValueFromLogs(tx, '_lockingId',1);
        await helpers.increaseTime((testSetup.periodsUnit+1)*3);
        //todo oren-- fill this up :)
        // var totalBid1 = await testSetup.continuousLocking4Reputation.auctions(id1);
        // var totalBid2 = await testSetup.continuousLocking4Reputation.auctions(id2);
        // var totalBid3 = await testSetup.continuousLocking4Reputation.auctions(id3);
        // assert.equal(web3.utils.BN(totalBid1).eq(web3.utils.BN(totalBid2)),true);
        // assert.equal(web3.utils.BN(totalBid1).eq(web3.utils.BN(totalBid3)),true);
        // assert.equal(totalBid1,web3.utils.toWei('1', "ether"));
        // assert.equal(id1,0);
        // assert.equal(id2,1);
        // assert.equal(id3,2);
        await testSetup.continuousLocking4Reputation.redeem(accounts[0],id1);
        await testSetup.continuousLocking4Reputation.redeem(accounts[0],id2);
        await testSetup.continuousLocking4Reputation.redeem(accounts[0],id3);
      //  assert.equal(await testSetup.org.reputation.balanceOf(accounts[0]),1000+300);
    });

    it("cannot initialize twice", async () => {
        let testSetup = await setup(accounts);
        try {
             await testSetup.continuousLocking4Reputation.initialize(testSetup.org.avatar.address,
                                                             testSetup.reputationReward,
                                                             testSetup.startTime,
                                                             testSetup.periodsUnit,
                                                             testSetup.redeemEnableTime,
                                                             testSetup.maxLockingPeriod,
                                                             testSetup.repRewardConstA,
                                                             testSetup.repRewardConstB,
                                                             testSetup.lockingToken.address,
                                                             testSetup.agreementHash,
                                                             {gas : constants.ARC_GAS_LIMIT});
             assert(false, "cannot initialize twice");
           } catch(error) {
             helpers.assertVMException(error);
           }
    });

    it("cannot bid with wrong _lockingPeriodToLockIn", async () => {
        var lockingPeriodToLockIn = 2;
        let testSetup = await setup(accounts);
        try {
             await testSetup.continuousLocking4Reputation.lock(web3.utils.toWei('1', "ether"),1,lockingPeriodToLockIn,testSetup.agreementHash);
             assert(false, "cannot lock with wrong _lockingPeriodToLockIn");
           } catch(error) {
             helpers.assertVMException(error);
           }
    });
});
