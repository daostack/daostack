pragma solidity ^0.4.19;

import "../globalConstraints/GlobalConstraintInterface.sol";


contract GlobalConstraintMock {

    struct TestParam {
        bool pre;
        bool post;
    }
    mapping (bytes=>TestParam) testParams;

    GlobalConstraintInterface.CallPhase currentCallPhase ;

    function setConstraint(bytes method,bool pre,bool post) public returns(bool) {
        testParams[method].pre = pre;
        testParams[method].post = post;
        currentCallPhase = GlobalConstraintInterface.CallPhase.Never;

        if (!pre && !post) {
            currentCallPhase = GlobalConstraintInterface.CallPhase.PreAndPost;
        } else {
            if (!pre) {
                currentCallPhase = GlobalConstraintInterface.CallPhase.Pre;
          } else if (!post) {
                     currentCallPhase = GlobalConstraintInterface.CallPhase.Post;
          }
        }

    }

    function pre(address, bytes32, bytes method) public view returns(bool) {
        return testParams[method].pre;
    }

    function post(address, bytes32 , bytes method) public view returns(bool) {
        return testParams[method].post;
    }

    function when() public view returns(GlobalConstraintInterface.CallPhase) {
        return currentCallPhase;
    }
}
