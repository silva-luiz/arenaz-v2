import {
  blockSchema,
  fieldSchema,
  priceRuleSchema,
  type Block,
  type BlockInput,
  type FieldInput,
  type FieldResponse,
  type FieldUpdate,
  type PriceRule,
  type PriceRuleInput,
} from '@arenaz/contracts';
import {
  schema,
  tstzrangeSql,
  type AvailabilityBlock,
  type Db,
  type Field,
  type NewField,
  type PriceRule as PriceRuleRow,
} from '@arenaz/db';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { FIELD_NOT_FOUND, VENUE_NOT_FOUND } from '../common/not-found.js';
import { textOrNull } from '../common/text.js';
import { DB, type DbHandle } from '../db/db.module.js';
import { findOwnedField, findOwnedVenue, isUuid } from '../venues/owner.js';
import {
  assertPublishedStaysComplete,
  lockVenueStatus,
} from '../venues/publishing.js';
import { toMeters } from '../venues/venues.service.js';

const { field, priceRule, availabilityBlock, venue } = schema;

export const BLOCK_NOT_FOUND = 'Bloqueio não encontrado';
export const BLOCK_OVERLAP_MESSAGE = 'Já existe um bloqueio nesse período';

// --------------------------------------------------------------- mapping ----

export function toPriceRule(row: PriceRuleRow): PriceRule {
  return priceRuleSchema.parse({
    id: row.id,
    weekdays: row.weekdays,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    priceCentsPerHour: row.priceCentsPerHour,
    label: row.label,
  });
}

export function toBlock(row: AvailabilityBlock): Block {
  return blockSchema.parse({
    id: row.id,
    startsAt: row.period.startsAt.toISOString(),
    endsAt: row.period.endsAt.toISOString(),
    reason: row.reason,
  });
}

/** Rules ordered by their first weekday, then start (id breaks ties). */
function sortRules(rows: PriceRuleRow[]): PriceRuleRow[] {
  const firstDay = (row: PriceRuleRow): number => Math.min(...row.weekdays);
  return [...rows].sort(
    (a, b) =>
      firstDay(a) - firstDay(b) ||
      a.startMinute - b.startMinute ||
      a.id.localeCompare(b.id),
  );
}

export function toField(
  row: Field,
  rules: PriceRuleRow[],
  blocks: AvailabilityBlock[],
): FieldResponse {
  return fieldSchema.parse({
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    sports: row.sports,
    surface: row.surface,
    format: row.format,
    lengthM: toMeters(row.lengthM),
    widthM: toMeters(row.widthM),
    minSlotMinutes: row.minSlotMinutes,
    basePriceCentsPerHour: row.basePriceCentsPerHour,
    isActive: row.isActive,
    priceRules: sortRules(rules).map(toPriceRule),
    blocks: blocks.map(toBlock),
  });
}

/** A measure in meters as the numeric column takes it; null stays NULL. */
function measureColumn(value: number | null): string | null {
  return value === null ? null : String(value);
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// --------------------------------------------------------------- service ----

@Injectable()
export class FieldsService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  async create(
    userId: string,
    venueId: string,
    input: FieldInput,
  ): Promise<FieldResponse> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    const id = await this.handle.db.transaction(async (tx) => {
      // The venue may have been deleted since the ownership check.
      if ((await lockVenueStatus(tx, owned.id)) === undefined) {
        throw new NotFoundException(VENUE_NOT_FOUND);
      }
      const [created] = await tx
        .insert(field)
        .values({
          venueId: owned.id,
          name: input.name,
          sports: input.sports,
          surface: input.surface,
          format: input.format,
          lengthM: input.lengthM === undefined ? null : String(input.lengthM),
          widthM: input.widthM === undefined ? null : String(input.widthM),
          minSlotMinutes: input.minSlotMinutes,
          basePriceCentsPerHour: input.basePriceCentsPerHour,
          isActive: input.isActive,
        })
        .returning({ id: field.id });
      if (!created) throw new Error('insert da quadra não retornou a linha');
      return created.id;
    });
    return this.load(id);
  }

  async get(userId: string, fieldId: string): Promise<FieldResponse> {
    const owned = await findOwnedField(this.handle.db, fieldId, userId);
    return this.load(owned.id);
  }

  async update(
    userId: string,
    fieldId: string,
    input: FieldUpdate,
  ): Promise<FieldResponse> {
    const owned = await findOwnedField(this.handle.db, fieldId, userId);
    const changes: Partial<NewField> = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.sports !== undefined) changes.sports = input.sports;
    if (input.surface !== undefined) changes.surface = input.surface;
    if (input.format !== undefined) changes.format = input.format;
    // null clears the measure; undefined leaves it alone.
    if (input.lengthM !== undefined)
      changes.lengthM = measureColumn(input.lengthM);
    if (input.widthM !== undefined)
      changes.widthM = measureColumn(input.widthM);
    if (input.minSlotMinutes !== undefined) {
      changes.minSlotMinutes = input.minSlotMinutes;
    }
    if (input.basePriceCentsPerHour !== undefined) {
      changes.basePriceCentsPerHour = input.basePriceCentsPerHour;
    }
    if (input.isActive !== undefined) changes.isActive = input.isActive;

    if (Object.keys(changes).length > 0) {
      await this.handle.db.transaction(async (tx) => {
        // Order matters (publishing guidance): lock the venue, mutate, then
        // check that a published venue is still complete.
        if ((await lockVenueStatus(tx, owned.venueId)) === undefined) {
          throw new NotFoundException(FIELD_NOT_FOUND);
        }
        const updated = await tx
          .update(field)
          .set({ ...changes, updatedAt: sql`now()` })
          .where(eq(field.id, owned.id))
          .returning({ id: field.id });
        if (updated.length === 0) throw new NotFoundException(FIELD_NOT_FOUND);
        await assertPublishedStaysComplete(tx, owned.venueId);
      });
    }
    return this.load(owned.id);
  }

  async remove(userId: string, fieldId: string): Promise<void> {
    const owned = await findOwnedField(this.handle.db, fieldId, userId);
    await this.handle.db.transaction(async (tx) => {
      if ((await lockVenueStatus(tx, owned.venueId)) === undefined) {
        throw new NotFoundException(FIELD_NOT_FOUND);
      }
      // Price rules and blocks go with it (ON DELETE CASCADE).
      const deleted = await tx
        .delete(field)
        .where(eq(field.id, owned.id))
        .returning({ id: field.id });
      if (deleted.length === 0) throw new NotFoundException(FIELD_NOT_FOUND);
      await assertPublishedStaysComplete(tx, owned.venueId);
    });
  }

  /** Replaces the whole set of price rules in one transaction. */
  async replacePriceRules(
    userId: string,
    fieldId: string,
    rules: PriceRuleInput[],
  ): Promise<PriceRule[]> {
    const owned = await findOwnedField(this.handle.db, fieldId, userId);
    const rows = await this.handle.db.transaction(async (tx) => {
      // The field lock makes two concurrent replacements run in sequence.
      await this.lockField(tx, owned.id);
      await tx.delete(priceRule).where(eq(priceRule.fieldId, owned.id));
      if (rules.length === 0) return [];
      return tx
        .insert(priceRule)
        .values(
          rules.map((rule) => ({
            fieldId: owned.id,
            weekdays: rule.weekdays,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
            priceCentsPerHour: rule.priceCentsPerHour,
            label: textOrNull(rule.label),
          })),
        )
        .returning();
    });
    return sortRules(rows).map(toPriceRule);
  }

  /**
   * Blocks a period. The overlap check and the insert share a transaction
   * holding the field row lock, so concurrent requests cannot both pass it.
   * Ranges are half-open, so ones that merely touch do not overlap.
   */
  async addBlock(
    userId: string,
    fieldId: string,
    input: BlockInput,
  ): Promise<Block> {
    const owned = await findOwnedField(this.handle.db, fieldId, userId);
    const period = {
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    };
    const created = await this.handle.db.transaction(async (tx) => {
      await this.lockField(tx, owned.id);
      const [clash] = await tx
        .select({ id: availabilityBlock.id })
        .from(availabilityBlock)
        .where(
          and(
            eq(availabilityBlock.fieldId, owned.id),
            sql`${availabilityBlock.period} && ${tstzrangeSql(period.startsAt, period.endsAt)}`,
          ),
        )
        .limit(1);
      if (clash) throw new ConflictException(BLOCK_OVERLAP_MESSAGE);
      const [row] = await tx
        .insert(availabilityBlock)
        .values({ fieldId: owned.id, period, reason: textOrNull(input.reason) })
        .returning();
      if (!row) throw new Error('insert do bloqueio não retornou a linha');
      return row;
    });
    return toBlock(created);
  }

  /** Ownership is checked through the join block → field → venue. */
  async removeBlock(userId: string, blockId: string): Promise<void> {
    if (!isUuid(blockId)) throw new NotFoundException(BLOCK_NOT_FOUND);
    const [owned] = await this.handle.db
      .select({ id: availabilityBlock.id })
      .from(availabilityBlock)
      .innerJoin(field, eq(availabilityBlock.fieldId, field.id))
      .innerJoin(venue, eq(field.venueId, venue.id))
      .where(and(eq(availabilityBlock.id, blockId), eq(venue.ownerId, userId)))
      .limit(1);
    if (!owned) throw new NotFoundException(BLOCK_NOT_FOUND);
    const deleted = await this.handle.db
      .delete(availabilityBlock)
      .where(eq(availabilityBlock.id, owned.id))
      .returning({ id: availabilityBlock.id });
    // Gone between the lookup and the delete (concurrent request).
    if (deleted.length === 0) throw new NotFoundException(BLOCK_NOT_FOUND);
  }

  /** `SELECT ... FOR UPDATE` on the field row; 404 if it just disappeared. */
  private async lockField(tx: Tx, fieldId: string): Promise<void> {
    const [row] = await tx
      .select({ id: field.id })
      .from(field)
      .where(eq(field.id, fieldId))
      .for('update');
    if (!row) throw new NotFoundException(FIELD_NOT_FOUND);
  }

  /** Field + its rules + blocks that have not ended yet (by start). */
  private async load(fieldId: string): Promise<FieldResponse> {
    const { db } = this.handle;
    const [row] = await db.select().from(field).where(eq(field.id, fieldId));
    if (!row) throw new NotFoundException(FIELD_NOT_FOUND);
    const rules = await db
      .select()
      .from(priceRule)
      .where(eq(priceRule.fieldId, fieldId));
    const blocks = await db
      .select()
      .from(availabilityBlock)
      .where(
        and(
          eq(availabilityBlock.fieldId, fieldId),
          gt(sql`upper(${availabilityBlock.period})`, sql`now()`),
        ),
      )
      .orderBy(
        asc(sql`lower(${availabilityBlock.period})`),
        asc(availabilityBlock.id),
      );
    return toField(row, rules, blocks);
  }
}
