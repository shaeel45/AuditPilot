import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

export const PLANS = {
  STARTER: 'starter',
  PRO: 'pro',
  AGENCY: 'agency',
};

export const LIMITS = {
  [PLANS.STARTER]: {
    audits: 5,
    pullRequests: 2,
  },
  [PLANS.PRO]: {
    audits: 100,
    pullRequests: 100,
  },
  [PLANS.AGENCY]: {
    audits: Infinity,
    pullRequests: Infinity,
  },
};

// Replace these with your actual Stripe Price IDs from the dashboard
export const STRIPE_PRICE_IDS = {
  [PLANS.PRO]: process.env.STRIPE_PRO_PRICE_ID || 'price_placeholder_pro',
  [PLANS.AGENCY]: process.env.STRIPE_AGENCY_PRICE_ID || 'price_placeholder_agency',
};
