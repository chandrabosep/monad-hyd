// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct Pool {
    uint256 id;
    string question;
    uint256 closeTime;
    uint256 totalYes;
    uint256 totalNo;
    bool resolved;
    bool winningSide;
    address creator;
}

struct Bet {
    uint256 amount;
    bool side;
    bool claimed;
}

contract MonHard {
    uint256 public nextPoolId = 1;
    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => Bet)) public bets;

    event PoolCreated(uint256 indexed poolId, string question, uint256 closeTime);

    error PoolClosed();
    error PoolNotResolved();
    error BettingClosed();
    error NoBet();
    error AlreadyClaimed();
    error NotWinner();
    error InvalidPool();
    error WrongSide();

    function createPool(string calldata question, uint256 closeTime) external returns (uint256 poolId) {
        require(closeTime > block.timestamp, "closeTime in past");
        poolId = nextPoolId++;
        pools[poolId] = Pool({
            id: poolId,
            question: question,
            closeTime: closeTime,
            totalYes: 0,
            totalNo: 0,
            resolved: false,
            winningSide: false,
            creator: msg.sender
        });
        emit PoolCreated(poolId, question, closeTime);
    }

    function bet(uint256 poolId, bool side) external payable {
        Pool storage p = pools[poolId];
        Bet storage b = bets[poolId][msg.sender];
        if (p.id == 0) revert InvalidPool();
        if (block.timestamp > p.closeTime) revert BettingClosed();
        if (p.resolved) revert PoolClosed();
        if (msg.value == 0) revert NoBet();
        if (b.amount > 0 && b.side != side) revert WrongSide();

        b.amount += msg.value;
        b.side = side;
        if (side) p.totalYes += msg.value;
        else p.totalNo += msg.value;
    }

    function resolve(uint256 poolId, bool winningSide) external {
        Pool storage p = pools[poolId];
        if (p.id == 0) revert InvalidPool();
        if (msg.sender != p.creator) revert InvalidPool();
        if (block.timestamp <= p.closeTime) revert BettingClosed();
        if (p.resolved) revert PoolClosed();

        p.resolved = true;
        p.winningSide = winningSide;
    }

    function claim(uint256 poolId) external {
        Pool storage p = pools[poolId];
        Bet storage b = bets[poolId][msg.sender];
        if (p.id == 0) revert InvalidPool();
        if (!p.resolved) revert PoolNotResolved();
        if (b.amount == 0) revert NoBet();
        if (b.claimed) revert AlreadyClaimed();
        if (b.side != p.winningSide) revert NotWinner();

        b.claimed = true;
        uint256 winAmount = (b.amount * (b.side ? p.totalNo : p.totalYes)) /
            (b.side ? p.totalYes : p.totalNo) + b.amount;
        (bool ok,) = msg.sender.call{value: winAmount}("");
        require(ok, "transfer failed");
    }
}
