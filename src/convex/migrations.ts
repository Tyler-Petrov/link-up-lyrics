import { Migrations, type MigrationFunctionReference } from '@convex-dev/migrations';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { internalMutation } from './functions';

export const migrations = new Migrations<DataModel>(components.migrations, { internalMutation });
export const run = migrations.runner();

/*
 * Migrations that `init` runs automatically after every deploy. Add each as
 * `internal.migrations.<name>`, defined with `migrations.define({ table, migrateOne })`.
 */
export const newMigrations: MigrationFunctionReference[] = [];
export const runNewMigrations = migrations.runner(newMigrations);
