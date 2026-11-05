import express from 'express';
import { query, transaction } from '../db/db.js';
import { authenticate, requireCharacter } from '../middleware/auth.js';
import { getWallet, transferFunds } from '../services/economy.service.js';
import { sendNotificationToProfile } from '../services/socket.service.js';

const router = express.Router();

/**
 * Get Wallet Balance & Transaction History
 */
router.get('/wallet', authenticate, requireCharacter, async (req, res) => {
  try {
    const planetId = req.user.planet_id || 1;
    const wallet = await getWallet(req.user.profile_id, planetId);

    // Fetch recent ledger transactions
    const txRes = await query(`
      SELECT t.*, 
             w_from.profile_id AS from_profile_id, p_from.character_name AS from_character_name,
             w_to.profile_id AS to_profile_id, p_to.character_name AS to_character_name
      FROM transactions t
      LEFT JOIN wallets w_from ON w_from.id = t.from_wallet_id
      LEFT JOIN player_profiles p_from ON p_from.id = w_from.profile_id
      LEFT JOIN wallets w_to ON w_to.id = t.to_wallet_id
      LEFT JOIN player_profiles p_to ON p_to.id = w_to.profile_id
      WHERE (t.from_wallet_id = $1 OR t.to_wallet_id = $1)
      ORDER BY t.created_at DESC
      LIMIT 30;
    `, [wallet.id]);

    return res.json({
      wallet,
      transactions: txRes.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch wallet ledger: ' + err.message });
  }
});

/**
 * Transfer Funds to Another Citizen
 */
router.post('/transfer', authenticate, requireCharacter, async (req, res) => {
  try {
    const { recipientUsername, recipientProfileId, amount, description } = req.body;
    const planetId = req.user.planet_id || 1;

    let targetProfileId = recipientProfileId ? parseInt(recipientProfileId, 10) : null;

    if (!targetProfileId && recipientUsername) {
      const recRes = await query('SELECT id FROM player_profiles WHERE username = $1;', [recipientUsername.trim().toLowerCase()]);
      if (recRes.rows.length === 0) {
        return res.status(404).json({ error: `Citizen @${recipientUsername} not found.` });
      }
      targetProfileId = recRes.rows[0].id;
    }

    if (!targetProfileId) {
      return res.status(400).json({ error: 'Recipient username or profile ID required.' });
    }

    const transferResult = await transferFunds({
      planetId,
      fromProfileId: req.user.profile_id,
      toProfileId: targetProfileId,
      amount,
      transactionType: 'transfer',
      description: description || `Direct transfer from ${req.user.character_name}`
    });

    // Notify recipient
    const notifRes = await query(`
      INSERT INTO notifications (profile_id, title, message, type, action_url)
      VALUES ($1, 'Funds Received', $2, 'economic', '/wallet.html')
      RETURNING *;
    `, [targetProfileId, `You received ₡${parseFloat(amount).toFixed(2)} from ${req.user.character_name}.`]);
    sendNotificationToProfile(targetProfileId, notifRes.rows[0]);

    return res.json({
      success: true,
      message: `Successfully transferred ₡${parseFloat(amount).toFixed(2)}!`,
      newBalance: transferResult.newSenderBalance,
      transaction: transferResult.transaction
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Get Bank Account Details
 */
router.get('/bank', authenticate, requireCharacter, async (req, res) => {
  try {
    const planetId = req.user.planet_id || 1;
    let bankRes = await query(`
      SELECT * FROM bank_accounts 
      WHERE profile_id = $1 AND planet_id = $2;
    `, [req.user.profile_id, planetId]);

    if (bankRes.rows.length === 0) {
      const accNum = `ARC-BNK-${Math.floor(10000 + Math.random() * 90000)}`;
      bankRes = await query(`
        INSERT INTO bank_accounts (profile_id, planet_id, account_number, balance, savings_rate)
        VALUES ($1, $2, $3, 0.00, 3.50)
        RETURNING *;
      `, [req.user.profile_id, planetId, accNum]);
    }

    return res.json({ account: bankRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch bank account.' });
  }
});

/**
 * Deposit Funds into Bank Account
 */
router.post('/bank/deposit', authenticate, requireCharacter, async (req, res) => {
  try {
    const { amount } = req.body;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive deposit amount required.' });
    }

    const planetId = req.user.planet_id || 1;

    await transaction(async (client) => {
      // Deduct from wallet
      const walletRes = await client.query(`
        SELECT * FROM wallets 
        WHERE profile_id = $1 AND planet_id = $2
        FOR UPDATE;
      `, [req.user.profile_id, planetId]);

      if (walletRes.rows.length === 0 || parseFloat(walletRes.rows[0].balance) < numericAmount) {
        throw new Error('Insufficient wallet balance for deposit.');
      }

      await client.query(`
        UPDATE wallets 
        SET balance = balance - $1 
        WHERE id = $2;
      `, [numericAmount, walletRes.rows[0].id]);

      // Credit to bank account
      await client.query(`
        UPDATE bank_accounts 
        SET balance = balance + $1 
        WHERE profile_id = $2 AND planet_id = $3;
      `, [numericAmount, req.user.profile_id, planetId]);

      // Record transaction
      await client.query(`
        INSERT INTO transactions (planet_id, from_wallet_id, amount, transaction_type, description)
        VALUES ($1, $2, $3, 'bank_deposit', 'Deposit into high-yield savings');
      `, [planetId, walletRes.rows[0].id, numericAmount]);
    });

    return res.json({ success: true, message: `Deposited ₡${numericAmount.toFixed(2)} into savings account.` });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Withdraw Funds from Bank Account
 */
router.post('/bank/withdraw', authenticate, requireCharacter, async (req, res) => {
  try {
    const { amount } = req.body;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive withdrawal amount required.' });
    }

    const planetId = req.user.planet_id || 1;

    await transaction(async (client) => {
      const bankRes = await client.query(`
        SELECT * FROM bank_accounts 
        WHERE profile_id = $1 AND planet_id = $2
        FOR UPDATE;
      `, [req.user.profile_id, planetId]);

      if (bankRes.rows.length === 0 || parseFloat(bankRes.rows[0].balance) < numericAmount) {
        throw new Error('Insufficient bank account balance.');
      }

      await client.query(`
        UPDATE bank_accounts 
        SET balance = balance - $1 
        WHERE id = $2;
      `, [numericAmount, bankRes.rows[0].id]);

      await client.query(`
        UPDATE wallets 
        SET balance = balance + $1 
        WHERE profile_id = $2 AND planet_id = $3;
      `, [numericAmount, req.user.profile_id, planetId]);

      await client.query(`
        INSERT INTO transactions (planet_id, to_wallet_id, amount, transaction_type, description)
        VALUES ($1, (SELECT id FROM wallets WHERE profile_id = $2 AND planet_id = $1), $3, 'bank_withdrawal', 'Withdrawal from savings');
      `, [planetId, req.user.profile_id, numericAmount]);
    });

    return res.json({ success: true, message: `Withdrew ₡${numericAmount.toFixed(2)} to wallet.` });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
