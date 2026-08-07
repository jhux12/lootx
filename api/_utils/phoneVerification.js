export const requireVerifiedPhone = async (adminAuth, uid) => {
  const userRecord = await adminAuth.getUser(uid);
  if (!userRecord.phoneNumber) {
    throw {
      status: 403,
      error: 'PHONE_VERIFICATION_REQUIRED',
      code: 'PHONE_VERIFICATION_REQUIRED',
      message: 'Verify your phone number before claiming free rewards.'
    };
  }
  return userRecord.phoneNumber;
};
