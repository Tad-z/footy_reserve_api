import mongoose from "mongoose";

export const toObjectId = (ids: any) => {
  try {
    if (ids.constructor === Array) {
      return ids.map((id: any) => new mongoose.Types.ObjectId(id));
    }
    return new mongoose.Types.ObjectId(ids);
  } catch (error) {
    console.log("toObjectId failed for", { ids });
    return ids;
  }
};

export function calculatePricePerSpot(totalAmount, spots) {
  const platformFeeRate = 0.05; // 5%
  const stripeFeeRate = 0.014; // 1.4%
  const stripeFixedFee = 0.20; // £0.20 per transaction

  // Price per spot formula ensuring admin still receives totalAmount after all deductions
  const pricePerSpot =
    ((totalAmount / spots) + stripeFixedFee) /
    (1 - stripeFeeRate - platformFeeRate);

  return parseFloat(pricePerSpot.toFixed(2)); // round to 2dp
}

export function calculateMatchPricing(totalAmount, spots) {
  const platformFeeRate = 0.05;
  const stripeFeeRate = 0.014;
  const stripeFixedFee = 0.20;

  const basePricePerSpot = totalAmount / spots;
  const finalPricePerSpot =
    ((basePricePerSpot) + stripeFixedFee) / (1 - stripeFeeRate - platformFeeRate);

  const platformFeePerSpot = finalPricePerSpot * platformFeeRate;
  const stripeFeePerSpot = finalPricePerSpot * stripeFeeRate + stripeFixedFee;

  return {
    basePricePerSpot: +basePricePerSpot.toFixed(2),
    platformFeePerSpot: +platformFeePerSpot.toFixed(2),
    stripeFeePerSpot: +stripeFeePerSpot.toFixed(2),
    finalPricePerSpot: +finalPricePerSpot.toFixed(2),
    platformFeeRate,
    stripeFeeRate,
    stripeFixedFee,
    totalExpected: +totalAmount.toFixed(2),
  };
}
