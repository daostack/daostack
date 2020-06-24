pragma solidity ^0.6.10;
// SPDX-License-Identifier: GPL-3.0


/**
 * @title ImplementationProvider
 * @dev Abstract contract for providing implementation addresses for other contracts by name.
 */
 // solhint-disable-next-line indent
abstract contract ImplementationProvider {
  /**
   * @dev Abstract function to return the implementation address of a contract.
   * @param contractName Name of the contract.
   * @return Implementation address of the contract.
   */
    function getImplementation(string memory contractName) public view virtual returns (address);
}
