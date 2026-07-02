// ============================================================
// Referrals Service — Juhnios Rold Frontend
// Wraps the customer referral code and admin redemption APIs.
// ============================================================

import { api } from './api';

const REFERRALS_PATH = '/referrals';

export interface ReferralCode {
  id: string;
  code: string;
  created_at: string;
}

export type ReferralRedemptionStatus = 'PENDING' | 'VALIDATED' | 'REWARDED' | 'REJECTED';

export interface ReferralRedemption {
  id: string;
  referral_code: string;
  referral_code_value: string;
  referrer_customer: string;
  referrer_name: string;
  referred_customer: string;
  referred_name: string;
  status: ReferralRedemptionStatus;
  redeemed_at: string;
  validated_at: string | null;
  notes: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function getMyReferralCode(): Promise<ReferralCode> {
  const res = await api.get<ReferralCode>(`${REFERRALS_PATH}/me/`);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function getReferralRedemptions(params?: {
  status?: ReferralRedemptionStatus;
}): Promise<PaginatedResponse<ReferralRedemption>> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  const res = await api.get<PaginatedResponse<ReferralRedemption>>(
    `${REFERRALS_PATH}/redemptions/${qs ? `?${qs}` : ''}`,
  );
  if (!res.data) throw new Error(res.message);
  return res.data;
}
