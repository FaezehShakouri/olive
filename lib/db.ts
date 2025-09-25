import { openDatabaseAsync } from "expo-sqlite";

export type Meal = { id: string; date: string; name: string; calories: number };

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

	await db.withTransactionAsync(async () => {
		if (v < 1) {
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
		}
	});
}

export async function ensureDb() {
	await migrate();
	return getDb();
}

export async function addMeal(meal: Meal) {
	const db = await ensureDb();
	await db.runAsync(
		"INSERT INTO meals (id, date, name, calories, created_at) VALUES (?, ?, ?, ?, ?)",
		[meal.id, meal.date, meal.name, meal.calories, Date.now()]
	);
}

export async function updateMeal(id: string, name: string, calories: number) {
	const db = await ensureDb();
	await db.runAsync("UPDATE meals SET name = ?, calories = ? WHERE id = ?", [name, calories, id]);
}

export async function deleteMeal(id: string) {
	const db = await ensureDb();
	await db.runAsync("DELETE FROM meals WHERE id = ?", [id]);
}

export async function getMealsByDate(date: string): Promise<Meal[]> {
	const db = await ensureDb();
	return db.getAllAsync<Meal>(
		"SELECT id, date, name, calories FROM meals WHERE date = ? ORDER BY created_at ASC",
		[date]
	);
}

export async function getAllMealsGroupedByDate(): Promise<Record<string, Meal[]>> {
	const db = await ensureDb();
	const rows = await db.getAllAsync<Meal>(
		"SELECT id, date, name, calories FROM meals ORDER BY date DESC, created_at ASC"
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
