import fs from "fs";
import path from "path";

const DB_DIR = path.join(__dirname, "..", "data");

const cache = new Map<string, any[]>();

function filePath(table: string): string {
  return path.join(DB_DIR, table + ".json");
}

function load(table: string): any[] {
  if (cache.has(table)) {
    return cache.get(table) as any[];
  }
  const fp = filePath(table);
  let data: any[] = [];
  if (fs.existsSync(fp)) {
    try {
      data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    } catch (err) {
      data = [];
    }
  }
  cache.set(table, data);
  return data;
}

function save(table: string): void {
  fs.writeFileSync(filePath(table), JSON.stringify(cache.get(table) || [], null, 2));
}

export function initSchema(tables: string[]): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  for (const table of tables) {
    if (!fs.existsSync(filePath(table))) {
      cache.set(table, []);
      save(table);
    }
  }
}

function findIndexById(rows: any[], id: string): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      return i;
    }
  }
  return -1;
}

export const store = {
  all<T = any>(table: string): T[] {
    return load(table).slice();
  },
  find<T = any>(table: string, predicate: (row: T) => boolean): T | undefined {
    return load(table).find(predicate as any);
  },
  filter<T = any>(table: string, predicate: (row: T) => boolean): T[] {
    return load(table).filter(predicate as any);
  },
  insert<T extends Record<string, any>>(table: string, row: T): T {
    const rows = load(table);
    rows.push(row);
    save(table);
    return row;
  },
  update<T extends { id: string }>(table: string, id: string, updates: Partial<T>): T | undefined {
    const rows = load(table);
    const idx = findIndexById(rows, id);
    if (idx === -1) {
      return undefined;
    }
    rows[idx] = Object.assign({}, rows[idx], updates);
    save(table);
    return rows[idx];
  },
  remove(table: string, id: string): boolean {
    const rows = load(table);
    const idx = findIndexById(rows, id);
    if (idx === -1) {
      return false;
    }
    rows.splice(idx, 1);
    save(table);
    return true;
  },
};
