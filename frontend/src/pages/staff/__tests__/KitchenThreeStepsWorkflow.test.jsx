import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { RequestsPage } from '../RequestsPage';
import { MyTasksPage } from '../MyTasksPage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Kitchen 3-Step Lifecycle Workflow Tests (RequestsPage & MyTasksPage)', () => {
  const requestsPagePath = path.resolve(__dirname, '../RequestsPage.jsx');
  const requestsPageContent = fs.readFileSync(requestsPagePath, 'utf8');

  const myTasksPagePath = path.resolve(__dirname, '../MyTasksPage.jsx');
  const myTasksPageContent = fs.readFileSync(myTasksPagePath, 'utf8');

  it('exports RequestsPage and MyTasksPage as functional components', () => {
    expect(typeof RequestsPage).toBe('function');
    expect(typeof MyTasksPage).toBe('function');
  });

  it('ensures no emojis in RequestsPage and MyTasksPage', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(requestsPageContent)).toBe(false);
    expect(emojiRegex.test(myTasksPageContent)).toBe(false);
  });

  it('verifies RequestsPage defines 3 standardized steps for Kitchen orders', () => {
    // 3 steps definition
    expect(requestsPageContent).toContain('KITCHEN_STEPS');
    expect(requestsPageContent).toContain('title: st("Pending")');
    expect(requestsPageContent).toContain('title: st("Cooking")');
    expect(requestsPageContent).toContain('title: st("Done")');

    // 3 step mapping function
    expect(requestsPageContent).toContain('getKitchenOrderStage');
    expect(requestsPageContent).toContain("nextStatus: 'Cooking'");
    expect(requestsPageContent).toContain('nextActionName: st("Accept and cook")');
    expect(requestsPageContent).toContain("nextStatus: 'Completed'");
    expect(requestsPageContent).toContain('nextActionName: st("Complete")');
  });

  it('verifies RequestsPage renders tab pills for Kitchen staff matching Dashboard', () => {
    // Kitchen staff gets tab pills: All, Pending, Cooking, Done
    expect(requestsPageContent).toContain("id: 'All', label: st('All')");
    expect(requestsPageContent).toContain("id: 'Pending', label: st('Pending')");
    expect(requestsPageContent).toContain("id: 'In Progress', label: st('Cooking')");
    expect(requestsPageContent).toContain("id: 'Completed', label: st('Done')");
  });

  it('verifies MyTasksPage defines 3 standardized steps for Kitchen orders', () => {
    expect(myTasksPageContent).toContain('KITCHEN_STEPS');
    expect(myTasksPageContent).toContain('getKitchenOrderStage');

    // Filter pills for Kitchen in MyTasksPage
    expect(myTasksPageContent).toContain("key: 'In Progress', label: st(\"Cooking ({0})\"");
    expect(myTasksPageContent).toContain("key: 'Completed', label: st(\"Done ({0})\"");
  });

  it('verifies stage mapping assigns step 1 to Pending, step 2 to Cooking, and step 3 to Done', () => {
    expect(requestsPageContent).toMatch(/isKitchenOrder\s*\?\s*KITCHEN_STEPS/);
    expect(myTasksPageContent).toMatch(/isKitchenOrder\s*\?\s*KITCHEN_STEPS/);
  });

  it('verifies Room Service completed direct service tasks are not counted in active tasks limit', () => {
    // Both RequestsPage and MyTasksPage must exclude completed tasks from active tasks
    expect(requestsPageContent).toContain('if (isTaskCompleted(r)) return false;');
    expect(myTasksPageContent).toContain('if (isTaskCompleted(r)) return false;');

    // Direct service stage for completed must be step 4
    expect(requestsPageContent).toContain('step: 4,');
    expect(requestsPageContent).toContain('label: st("Completed")');
  });
});

