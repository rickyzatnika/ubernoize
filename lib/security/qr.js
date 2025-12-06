import crypto from 'crypto';

// Get secret key from environment - should be at least 32 characters
const QR_SECRET_KEY = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production-32chars';

if (process.env.NODE_ENV === 'production' && QR_SECRET_KEY === 'default-secret-key-change-in-production-32chars') {
  throw new Error('QR_SECRET_KEY must be set in production environment');
}

/**
 * Generate secure QR code data with digital signature
 */
export function generateSecureQRData(orderData, userData, eventData) {
  const now = Date.now();
  const eventDate = new Date(eventData.date).getTime();
  
  // Create payload with essential data
  const payload = {
    orderId: String(orderData._id),
    eventId: String(eventData._id),
    userId: String(userData._id),
    userEmail: userData.email,
    eventName: eventData.name,
    eventDate: eventDate,
    totalAmount: orderData.total,
    ticketCount: orderData.items.reduce((sum, item) => sum + item.qty, 0),
    issuedAt: now,
    expiresAt: eventDate + (24 * 60 * 60 * 1000), // Expires 24 hours after event
    version: '1.0' // For future compatibility
  };
  
  // Create HMAC-SHA256 signature
  const dataToSign = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', QR_SECRET_KEY)
    .update(dataToSign)
    .digest('hex');
  
  // Return signed payload
  return {
    ...payload,
    signature
  };
}

/**
 * Verify QR code signature and validate ticket
 */
export function verifyQRSignature(qrData) {
  try {
    if (!qrData || typeof qrData !== 'object') {
      return { valid: false, error: 'Invalid QR data format' };
    }
    
    const { signature, ...payload } = qrData;
    
    if (!signature) {
      return { valid: false, error: 'Missing signature' };
    }
    
    // Recreate signature
    const dataToSign = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET_KEY)
      .update(dataToSign)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (!isSignatureValid) {
      return { valid: false, error: 'Invalid signature - ticket may be forged' };
    }
    
    // Check expiration
    const now = Date.now();
    if (now > payload.expiresAt) {
      return { valid: false, error: 'Ticket has expired' };
    }
    
    // Check if event hasn't started yet (optional grace period)
    if (now > payload.eventDate + (6 * 60 * 60 * 1000)) { // 6 hours after event starts
      return { valid: false, error: 'Event has already ended' };
    }
    
    return { 
      valid: true, 
      payload,
      message: 'Ticket is valid'
    };
    
  } catch (error) {
    console.error('QR verification error:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Generate verification code for manual entry (backup)
 */
export function generateVerificationCode(orderId, eventId) {
  const combined = `${orderId}-${eventId}`;
  const hash = crypto
    .createHash('sha256')
    .update(combined + QR_SECRET_KEY)
    .digest('hex');
  
  // Take first 8 characters and make uppercase
  return hash.substring(0, 8).toUpperCase();
}

/**
 * Verify manual verification code
 */
export function verifyManualCode(code, orderId, eventId) {
  const expectedCode = generateVerificationCode(orderId, eventId);
  return code.toUpperCase() === expectedCode;
}