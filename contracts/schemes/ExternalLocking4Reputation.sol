pragma solidity ^0.4.25;

import "./Locking4Reputation.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/**
 * @title A scheme for external locking Tokens for reputation
 */

contract ExternalLocking4Reputation is Locking4Reputation, Ownable {

    event Register(address indexed _beneficiary);

    address public externalLockingContract;
    string public getBalanceFuncSignature;

    // locker -> bool
    mapping(address => bool) public externalLockers;
    //      beneficiary -> bool
    mapping(address     => bool) public registrar;

    /**
     * @dev initialize
     * @param _avatar the avatar to mint reputation from
     * @param _reputationReward the total reputation this contract will reward
     *        for the token locking
     * @param _claimingStartTime claiming starting period time.
     * @param _claimingEndTime the claiming end time.
     *        claiming is disable after this time.
     * @param _redeemEnableTime redeem enable time .
     *        redeem reputation can be done after this time.
     * @param _externalLockingContract the contract which lock the token.
     * @param _getBalanceFuncSignature get balance function signature
     *        e.g "lockedTokenBalances(address)"
     */
    function initialize(
        Avatar _avatar,
        uint _reputationReward,
        uint _claimingStartTime,
        uint _claimingEndTime,
        uint _redeemEnableTime,
        address _externalLockingContract,
        string _getBalanceFuncSignature)
    external
    onlyOwner
    {
        require(_claimingEndTime > _claimingStartTime, "_claimingEndTime should be greater than _claimingStartTime");
        externalLockingContract = _externalLockingContract;
        getBalanceFuncSignature = _getBalanceFuncSignature;
        super._initialize(
        _avatar,
        _reputationReward,
        _claimingStartTime,
        _claimingEndTime,
        _redeemEnableTime,
        1);
    }

    /**
     * @dev claim function
     * @param _beneficiary the beneficiary address to claim for
     *        if _beneficiary == 0 the claim will be for the msg.sender.
     * @return claimId
     */
    function claim(address _beneficiary) public returns(bytes32) {
        require(avatar != Avatar(0), "should initialize first");
        address beneficiary;
        if (_beneficiary == address(0)) {
            beneficiary = msg.sender;
        } else {
            require(registrar[_beneficiary],"beneficiary should be register");
            beneficiary = _beneficiary;
        }
        require(externalLockers[beneficiary] == false, "claiming twice for the same beneficiary is not allowed");
        externalLockers[beneficiary] = true;
        // solium-disable-next-line security/no-low-level-calls
        bool result = externalLockingContract.call(abi.encodeWithSignature(getBalanceFuncSignature, beneficiary));
        uint lockedAmount;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
          returndatacopy(0, 0, returndatasize)
          switch result
          // call returns 0 on error.
          case 0 { revert(0, returndatasize) }
          default { lockedAmount := mload(0) }
        }

        return super._lock(lockedAmount, 1, beneficiary,1,1);
    }

  /**
    * @dev register function
    *      register for external locking claim
    */
    function register() public {
        registrar[msg.sender] = true;
        emit Register(msg.sender);
    }
}