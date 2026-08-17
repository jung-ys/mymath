'use strict';

const crypto = require('crypto');

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const hashBuf = Buffer.from(hash, 'hex');
    const testBuf = crypto.scryptSync(String(secret), salt, 64);
    if (hashBuf.length !== testBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, testBuf);
  } catch {
    return false;
  }
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { hashSecret, verifySecret, randomToken };
