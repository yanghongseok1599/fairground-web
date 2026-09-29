// Read the same schedule and seed names as the operating guide.
import { courtMatches, timeline } from '../../public/cup-ops/data.js';
import { teamSeeds } from '../../public/cup-ops/team-seeds.js';

console.log(JSON.stringify({ teamSeeds, courtMatches, timeline }));
