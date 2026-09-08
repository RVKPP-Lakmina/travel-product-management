/**
 * Canned examples for the two AI entry points. Kept together so they're
 * reviewed as a pair, but they are NOT interchangeable:
 *
 *  - GENERATE_PROMPTS describe a product to *create* (POST /ai/generate-product)
 *  - SEARCH_QUERIES describe a filter to *apply* (POST /ai/search)
 */

export const GENERATE_PROMPTS = [
  'Create a Dinner Buffet at Cinnamon Grand Colombo available until the end of this month.',
  'A private sunrise safari at Yala National Park, LKR 45,000, valid for the next 3 months.',
  'Airport transfer service from Bandaranaike Airport to Colombo hotels, available year-round.',
]

export const SEARCH_QUERIES = [
  'Dinner buffets in Colombo under LKR 10,000',
  'Active family packages in Yala',
  'Cultural tours valid next month',
]
