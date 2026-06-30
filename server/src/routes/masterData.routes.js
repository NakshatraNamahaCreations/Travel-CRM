import { Destination } from '../models/Destination.js';
import { QuerySource } from '../models/QuerySource.js';
import { Tag } from '../models/Tag.js';
import { crudFactory } from '../utils/crudFactory.js';
import { makeCrudRouter } from './_crudRouter.js';

// Sales reps may create destinations/sources/tags on the fly from the query form.
const openWrite = { writeRoles: ['admin', 'manager', 'sales'] };

export const destinationRoutes = makeCrudRouter(
  crudFactory(Destination, { searchFields: ['name', 'country', 'region'], sort: 'name' }),
  { writeRoles: ['admin', 'manager', 'sales', 'operations'] }
);

export const querySourceRoutes = makeCrudRouter(crudFactory(QuerySource), openWrite);

export const tagRoutes = makeCrudRouter(
  crudFactory(Tag, { beforeWrite: (body) => ({ ...body, name: String(body.name).toLowerCase().trim() }) }),
  openWrite
);
