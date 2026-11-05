import { transaction, query } from '../db/db.js';

/**
 * Get or create wallet for profile on a given planet
 */
export async function getWallet(profileId, planetId) {
  let res = await query(`
    SELECT * FROM wallets 
    WHERE profile_id = $1 AND planet_id = $2;
  `, [profileId, planetId]);

  if (res.rows.length === 0) {
    const createRes = await query(`
      INSERT INTO wallets (profile_id, planet_id, balance)
      VALUES ($1, $2, 500.00)
      RETURNING *;
    `, [profileId, planetId]);
    return createRes.rows[0];
  }
  return res.rows[0];
}

/**
 * Atomic transfer of funds between two player wallets
 */
export async function transferFunds({
  planetId,
  fromProfileId,
  toProfileId,
  amount,
  transactionType = 'transfer',
  referenceType = 'direct',
  referenceId = null,
  description = 'Direct citizen transfer'
}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Transaction amount must be a positive number.');
  }

  if (fromProfileId === toProfileId) {
    throw new Error('Cannot transfer funds to the same profile.');
  }

  return await transaction(async (client) => {
    // 1. Fetch & lock sender wallet
    const senderRes = await client.query(`
      SELECT * FROM wallets 
      WHERE profile_id = $1 AND planet_id = $2
      FOR UPDATE;
    `, [fromProfileId, planetId]);

    if (senderRes.rows.length === 0) {
      throw new Error('Sender wallet does not exist.');
    }
    const senderWallet = senderRes.rows[0];

    if (senderWallet.is_locked) {
      throw new Error('Sender wallet is temporarily locked by administration.');
    }

    const currentBalance = parseFloat(senderWallet.balance);
    if (currentBalance < numericAmount) {
      throw new Error(`Insufficient funds. Current balance: ₡${currentBalance.toFixed(2)}, required: ₡${numericAmount.toFixed(2)}`);
    }

    // 2. Fetch or create receiver wallet
    let receiverRes = await client.query(`
      SELECT * FROM wallets 
      WHERE profile_id = $1 AND planet_id = $2
      FOR UPDATE;
    `, [toProfileId, planetId]);

    let receiverWallet;
    if (receiverRes.rows.length === 0) {
      const newRec = await client.query(`
        INSERT INTO wallets (profile_id, planet_id, balance)
        VALUES ($1, $2, 0.00)
        RETURNING *;
      `, [toProfileId, planetId]);
      receiverWallet = newRec.rows[0];
    } else {
      receiverWallet = receiverRes.rows[0];
    }

    // 3. Atomically update balances
    await client.query(`
      UPDATE wallets 
      SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [numericAmount, senderWallet.id]);

    await client.query(`
      UPDATE wallets 
      SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [numericAmount, receiverWallet.id]);

    // 4. Record transaction in immutable ledger
    const txRes = await client.query(`
      INSERT INTO transactions (
        planet_id, from_wallet_id, to_wallet_id, amount,
        transaction_type, reference_type, reference_id, description, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
      RETURNING *;
    `, [
      planetId,
      senderWallet.id,
      receiverWallet.id,
      numericAmount,
      transactionType,
      referenceType,
      referenceId,
      description
    ]);

    return {
      success: true,
      transaction: txRes.rows[0],
      newSenderBalance: currentBalance - numericAmount,
    };
  });
}

/**
 * Grant rewards, salaries, or dividends (Minting / Treasury Payout)
 */
export async function grantFunds({
  planetId,
  toProfileId,
  amount,
  transactionType = 'reward',
  referenceType = null,
  referenceId = null,
  description = 'Civic reward distribution'
}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Reward amount must be a positive number.');
  }

  return await transaction(async (client) => {
    let receiverRes = await client.query(`
      SELECT * FROM wallets 
      WHERE profile_id = $1 AND planet_id = $2
      FOR UPDATE;
    `, [toProfileId, planetId]);

    let receiverWallet;
    if (receiverRes.rows.length === 0) {
      const newRec = await client.query(`
        INSERT INTO wallets (profile_id, planet_id, balance)
        VALUES ($1, $2, 0.00)
        RETURNING *;
      `, [toProfileId, planetId]);
      receiverWallet = newRec.rows[0];
    } else {
      receiverWallet = receiverRes.rows[0];
    }

    await client.query(`
      UPDATE wallets 
      SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [numericAmount, receiverWallet.id]);

    const txRes = await client.query(`
      INSERT INTO transactions (
        planet_id, from_wallet_id, to_wallet_id, amount,
        transaction_type, reference_type, reference_id, description, status
      )
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'completed')
      RETURNING *;
    `, [
      planetId,
      receiverWallet.id,
      numericAmount,
      transactionType,
      referenceType,
      referenceId,
      description
    ]);

    return {
      success: true,
      transaction: txRes.rows[0],
      newBalance: parseFloat(receiverWallet.balance) + numericAmount
    };
  });
}

/**
 * Deduct system fees, tuition, or purchases without another player wallet
 */
export async function deductFunds({
  planetId,
  fromProfileId,
  amount,
  transactionType = 'fee',
  description = 'Civic service fee'
}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Deduction amount must be a positive number.');
  }

  return await transaction(async (client) => {
    const senderRes = await client.query(`
      SELECT * FROM wallets 
      WHERE profile_id = $1 AND planet_id = $2
      FOR UPDATE;
    `, [fromProfileId, planetId]);

    if (senderRes.rows.length === 0) {
      throw new Error('Wallet not found.');
    }
    const wallet = senderRes.rows[0];
    const balance = parseFloat(wallet.balance);

    if (balance < numericAmount) {
      throw new Error(`Insufficient balance. Current: ₡${balance.toFixed(2)}, required: ₡${numericAmount.toFixed(2)}`);
    }

    await client.query(`
      UPDATE wallets 
      SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [numericAmount, wallet.id]);

    const txRes = await client.query(`
      INSERT INTO transactions (
        planet_id, from_wallet_id, to_wallet_id, amount,
        transaction_type, description, status
      )
      VALUES ($1, $2, NULL, $3, $4, $5, 'completed')
      RETURNING *;
    `, [planetId, wallet.id, numericAmount, transactionType, description]);

    return {
      success: true,
      transaction: txRes.rows[0],
      newBalance: balance - numericAmount,
    };
  });
}

export default {
  getWallet,
  transferFunds,
  grantFunds,
  deductFunds,
};
