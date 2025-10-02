import * as FileSystem from "expo-file-system/legacy";
import { openDatabaseAsync } from "expo-sqlite";

export type Meal = { id: string; date: string; name: string; calories: number; time: string; ingredients?: string; created_at?: number };

const DB_NAME = "olive.db";
let dbPromise: ReturnType<typeof openDatabaseAsync> | null = null;

async function getDb() {
	if (!dbPromise) dbPromise = openDatabaseAsync(DB_NAME);
	return dbPromise;
}

async function migrate() {
	const db = await getDb();
	await db.execAsync("PRAGMA journal_mode = WAL;");
	const [{ user_version }] = await db.getAllAsync<{ user_version: number }>("PRAGMA user_version;");
	let v = user_version ?? 0;

	// Check if ingredients column exists (for cases where migration might have failed)
	let ingredientsColumnExists = false;
	try {
		const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(meals);");
		ingredientsColumnExists = columns.some(col => col.name === 'ingredients');
	} catch (error) {
		// Table might not exist yet, that's fine
	}

	if (v < 1) {
		await db.withTransactionAsync(async () => {
			await db.execAsync(`
        CREATE TABLE IF NOT EXISTS meals (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL,
          name TEXT NOT NULL,
          calories REAL NOT NULL CHECK (calories > 0),
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
        );
      `);
			await db.execAsync("PRAGMA user_version = 1;");
			v = 1;
		});
	}

	if (v < 2) {
		await db.withTransactionAsync(async () => {
			await db.execAsync(`
        ALTER TABLE meals ADD COLUMN time TEXT DEFAULT '12:00';
      `);
			await db.execAsync("PRAGMA user_version = 2;");
			v = 2;
		});
	}

	if (v < 3 || !ingredientsColumnExists) {
		try {
			await db.withTransactionAsync(async () => {
				await db.execAsync(`
          ALTER TABLE meals ADD COLUMN ingredients TEXT;
        `);
			});
			await db.execAsync("PRAGMA user_version = 3;");
			v = 3;
		} catch (error) {
			// Column might already exist, check if it's a "duplicate column" error
			if (error instanceof Error && (error.message.includes("duplicate column name") || error.message.includes("duplicate column"))) {
				// Column already exists, just update version
				await db.execAsync("PRAGMA user_version = 3;");
				v = 3;
			} else {
				throw error;
			}
		}
	}
}

export async function ensureDb() {
	await migrate();
	return getDb();
}

export async function addMeal(meal: Meal) {
	const db = await ensureDb();
	await db.runAsync(
		"INSERT INTO meals (id, date, name, calories, time, ingredients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		[meal.id, meal.date, meal.name, meal.calories, meal.time, meal.ingredients || null, Date.now()]
	);
}

export async function updateMeal(id: string, name: string, calories: number, time?: string) {
	const db = await ensureDb();
	if (time !== undefined) {
		await db.runAsync("UPDATE meals SET name = ?, calories = ?, time = ? WHERE id = ?", [name, calories, time, id]);
	} else {
		await db.runAsync("UPDATE meals SET name = ?, calories = ? WHERE id = ?", [name, calories, id]);
	}
}

export async function deleteMeal(id: string) {
	const db = await ensureDb();
	await db.runAsync("DELETE FROM meals WHERE id = ?", [id]);
}

export async function getMealsByDate(date: string): Promise<Meal[]> {
	const db = await ensureDb();
	return db.getAllAsync<Meal>(
		"SELECT id, date, name, calories, COALESCE(time, '12:00') as time, ingredients, created_at FROM meals WHERE date = ? ORDER BY time ASC, created_at ASC",
		[date]
	);
}

export async function getAllMealsGroupedByDate(): Promise<Record<string, Meal[]>> {
	const db = await ensureDb();
	const rows = await db.getAllAsync<Meal>(
		"SELECT id, date, name, calories, COALESCE(time, '12:00') as time, ingredients, created_at FROM meals ORDER BY date DESC, time ASC, created_at ASC"
	);
	const map: Record<string, Meal[]> = {};
	for (const r of rows) {
		if (!map[r.date]) map[r.date] = [];
		map[r.date].push(r);
	}
	return map;
}

export async function getTotalsByDate(): Promise<Record<string, number>> {
	const db = await ensureDb();
	const rows = await db.getAllAsync<{ date: string; total: number }>(
		"SELECT date, SUM(calories) as total FROM meals GROUP BY date ORDER BY date DESC"
	);
	const map: Record<string, number> = {};
	for (const r of rows) map[r.date] = Number(r.total ?? 0);
	return map;
}

// admin/bulk helpers

function isISODate(s: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function clearAllMeals() {
	const db = await ensureDb();
	await db.execAsync("DELETE FROM meals");
}

export async function resetDatabase() {
	const db = await getDb();
	await db.closeAsync();
	// Delete the database file
	const { deleteAsync } = await import("expo-file-system");
	try {
		await deleteAsync(`${FileSystem.documentDirectory}SQLite/${DB_NAME}`);
	} catch (error) {
		// Database file might not exist, that's fine
	}
	// Reset the database promise so it gets recreated
	dbPromise = null;
	// Run migration on the new database
	await ensureDb();
}

export async function debugDatabaseSchema() {
	const db = await ensureDb();
	const columns = await db.getAllAsync<{ name: string; type: string }>("PRAGMA table_info(meals);");
	const version = await db.getAllAsync<{ user_version: number }>("PRAGMA user_version;");
	return { columns, version: version[0]?.user_version ?? 0 };
}

export type ImportResult = { added: number; updated: number; skipped: number };

export async function bulkUpsertMeals(input: unknown): Promise<ImportResult> {
	// Accepts:
	// - Array<{ id?, date, name, calories }>
	// - Record<date, Array<{ id?, name, calories }>>
	const db = await ensureDb();

	type InItem = Partial<Meal> & { date: string; name: string; calories: number; time?: string; ingredients?: string };

	let items: InItem[] = [];
	if (Array.isArray(input)) {
		items = input as InItem[];
	} else if (input && typeof input === "object") {
		for (const [date, arr] of Object.entries(input as Record<string, any[]>)) {
			if (!Array.isArray(arr)) continue;
			for (const it of arr) items.push({ ...it, date });
		}
	}

	if (items.length === 0) return { added: 0, updated: 0, skipped: 0 };

	let added = 0, updated = 0, skipped = 0;
	const now = Date.now();

	await db.withTransactionAsync(async () => {
		for (const it of items) {
			const date = String(it.date ?? "").trim();
			const name = String(it.name ?? "").trim();
			const calories = Number(it.calories);
			const time = String(it.time ?? "12:00").trim();
			const ingredients = it.ingredients ? String(it.ingredients).trim() : null;
			if (!isISODate(date) || !name || !Number.isFinite(calories) || calories <= 0) {
				skipped++;
				continue;
			}
			const id = (it.id ? String(it.id) : String(now + Math.random())).replace(/\s+/g, "");
			// Use UPSERT; treat replaced rows as updates.
			await db.runAsync(
				"INSERT INTO meals (id, date, name, calories, time, ingredients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET date=excluded.date, name=excluded.name, calories=excluded.calories, time=excluded.time, ingredients=excluded.ingredients",
				[id, date, name, calories, time, ingredients, now]
			);
			// Heuristic: if client supplied an id, count as updated; else added.
			if (it.id) updated++; else added++;
		}
	});

	return { added, updated, skipped };
}

export async function getNameSuggestions(prefix: string, limit: number = 8): Promise<{ name: string; calories: number }[]> {
	const db = await ensureDb();
	const like = (prefix ?? "").trim().replace(/[%_]/g, "") + "%";
	const rows = await db.getAllAsync<{ name: string; calories: number }>(
		`SELECT name, calories
     FROM meals
     WHERE name LIKE ?
     GROUP BY name, calories
     ORDER BY MAX(created_at) DESC, COUNT(*) DESC
     LIMIT ?`,
		[like, String(limit)]
	);
	return rows.map(r => ({ name: r.name, calories: r.calories }));
}

