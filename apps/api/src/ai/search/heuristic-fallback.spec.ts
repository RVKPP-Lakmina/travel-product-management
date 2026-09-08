import { describe, expect, it } from 'vitest';
import { heuristicParse, type CategoryLookup } from './heuristic-fallback.js';

// Mirrors supabase/migrations/20260908000001_init.sql's categories seed
// exactly — if that migration's synonyms change, this fixture should be
// updated to match, since the whole point is testing against real data
// shape, not an idealized one.
const CATEGORIES: CategoryLookup[] = [
  { slug: 'dining', name: 'Dining', synonyms: ['buffet', 'dinner', 'lunch', 'breakfast', 'restaurant', 'meal', 'food'] },
  { slug: 'excursion', name: 'Excursion', synonyms: ['tour', 'trip', 'day-trip', 'sightseeing', 'walking tour'] },
  { slug: 'safari', name: 'Wildlife Safari', synonyms: ['safari', 'wildlife', 'national park', 'leopard', 'elephant'] },
  { slug: 'accommodation', name: 'Accommodation', synonyms: ['hotel', 'stay', 'room', 'suite', 'resort', 'villa'] },
  { slug: 'transport', name: 'Transport', synonyms: ['transfer', 'airport', 'pickup', 'drop-off', 'taxi', 'shuttle', 'chauffeur'] },
  { slug: 'family', name: 'Family Package', synonyms: ['family', 'kids', 'children', 'package'] },
  { slug: 'wellness', name: 'Wellness & Spa', synonyms: ['spa', 'wellness', 'ayurveda', 'massage', 'yoga'] },
  { slug: 'cultural', name: 'Cultural', synonyms: ['cultural', 'heritage', 'temple', 'historical', 'festival'] },
  { slug: 'adventure', name: 'Adventure', synonyms: ['adventure', 'hiking', 'trekking', 'rafting', 'diving', 'surfing'] },
  { slug: 'shopping', name: 'Shopping', synonyms: ['shopping', 'market', 'souvenir'] },
];

const DESTINATIONS = ['Colombo', 'Sigiriya', 'Yala', 'Kandy', 'Ella', 'Nuwara Eliya', 'Galle', 'Bentota', 'Negombo', 'Kegalle'];

describe('heuristicParse — the four example queries from the spec PDF', () => {
  it('"Show me dinner buffets in Colombo"', () => {
    const filter = heuristicParse('Show me dinner buffets in Colombo', CATEGORIES, DESTINATIONS);
    expect(filter.categories).toContain('dining');
    expect(filter.destinations).toContain('Colombo');
  });

  it('"Show active family packages"', () => {
    const filter = heuristicParse('Show active family packages', CATEGORIES, DESTINATIONS);
    expect(filter.status).toBe('active');
    expect(filter.categories).toContain('family');
  });

  it('"Show products below LKR 10,000"', () => {
    const filter = heuristicParse('Show products below LKR 10,000', CATEGORIES, DESTINATIONS);
    expect(filter.price?.max).toBe(10000);
    expect(filter.price?.min).toBeNull();
  });

  it('"Show airport transfer services"', () => {
    const filter = heuristicParse('Show airport transfer services', CATEGORIES, DESTINATIONS);
    expect(filter.categories).toContain('transport');
  });
});

describe('heuristicParse — additional coverage', () => {
  it('handles "above" and "over" as a price minimum', () => {
    expect(heuristicParse('tours above LKR 5000', CATEGORIES, DESTINATIONS).price?.min).toBe(5000);
    expect(heuristicParse('anything over 20000', CATEGORIES, DESTINATIONS).price?.min).toBe(20000);
  });

  it('handles an explicit price range', () => {
    const filter = heuristicParse('safaris between 30000-50000', CATEGORIES, DESTINATIONS);
    expect(filter.price?.min).toBe(30000);
    expect(filter.price?.max).toBe(50000);
  });

  it('detects inactive status', () => {
    expect(heuristicParse('show inactive listings', CATEGORIES, DESTINATIONS).status).toBe('inactive');
  });

  it('defaults status to "any" when not mentioned', () => {
    expect(heuristicParse('dinner buffets', CATEGORIES, DESTINATIONS).status).toBe('any');
  });

  it('never returns more than the schema-capped number of destinations/categories', () => {
    const filter = heuristicParse('Colombo Kandy Ella Galle Bentota Negombo Kegalle', CATEGORIES, DESTINATIONS);
    expect(filter.destinations.length).toBeLessThanOrEqual(5);
  });

  it('is injection-inert: a raw SQL-shaped string produces only ordinary keywords, nothing structural', () => {
    const filter = heuristicParse("'; drop table products; --", CATEGORIES, DESTINATIONS);
    expect(filter.categories).toEqual([]);
    expect(filter.destinations).toEqual([]);
    expect(filter.status).toBe('any');
    // Whatever survives becomes plain lowercase alphanumeric keyword
    // tokens — never anything resembling executable syntax.
    for (const kw of filter.keywords) {
      expect(kw).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('an unrecognized query with no matches produces an all-default filter plus leftover keywords', () => {
    const filter = heuristicParse('something completely unrelated', CATEGORIES, DESTINATIONS);
    expect(filter.categories).toEqual([]);
    expect(filter.destinations).toEqual([]);
    expect(filter.keywords.length).toBeGreaterThan(0);
  });
});
