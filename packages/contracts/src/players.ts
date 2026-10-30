/**
 * Group size the booking flow offers (venue page counter, search bar, checkout
 * and the `?jogadores=` parameter): 2 to 30 players, 14 unless the person said.
 * Only a hint for the person: the API neither filters nor prices by it.
 */
export const PLAYERS_RANGE = { min: 2, max: 30, default: 14 } as const;
