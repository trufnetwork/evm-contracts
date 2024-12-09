// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

abstract contract TNAccessControl is AccessControlDefaultAdminRules {
    // Role definitions
    // See Roles usage in TNConsumer.sol for more information
    bytes32 public constant SOURCE_KEEPER_ROLE =
        keccak256("SOURCE_KEEPER_ROLE");
    bytes32 public constant SECRETS_KEEPER_ROLE =
        keccak256("SECRETS_KEEPER_ROLE");
    bytes32 public constant PAUSE_KEEPER_ROLE = keccak256("PAUSE_KEEPER_ROLE");
    bytes32 public constant WHITELIST_KEEPER_ROLE = keccak256("WHITELIST_KEEPER_ROLE");
    bytes32 public constant READER_ROLE = keccak256("READER_ROLE");

    constructor(
        uint48 initialDelay,
        address initialAdmin
    ) AccessControlDefaultAdminRules(initialDelay, initialAdmin) {
        // Set up role hierarchy
        _setRoleAdmin(SOURCE_KEEPER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(SECRETS_KEEPER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PAUSE_KEEPER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(WHITELIST_KEEPER_ROLE, DEFAULT_ADMIN_ROLE);
        // Reader role is controlled by the whitelist keeper
        _setRoleAdmin(READER_ROLE, WHITELIST_KEEPER_ROLE);
    }
}
