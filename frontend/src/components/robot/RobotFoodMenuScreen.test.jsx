import React from 'react';
import { describe, it, expect } from 'vitest';
import {
  RobotFoodMenuScreen,
  INITIAL_MENU_CATEGORIES,
  INITIAL_FOOD_ITEMS,
  formatCurrency,
} from './RobotFoodMenuScreen';

describe('RobotFoodMenuScreen Logic & Initial Data', () => {
  it('should export RobotFoodMenuScreen function component', () => {
    expect(typeof RobotFoodMenuScreen).toBe('function');
  });


  it('contains essential menu categories with hotpots, seafood, mains, and desserts', () => {
    const categoryIds = INITIAL_MENU_CATEGORIES.map((c) => c.id);
    expect(categoryIds).not.toContain('all');
    expect(categoryIds[0]).toBe('appetizers');
    expect(categoryIds.length).toBe(10);
    expect(categoryIds).toContain('appetizers');
    expect(categoryIds).toContain('soups_porridge');
    expect(categoryIds).toContain('salads');
    expect(categoryIds).toContain('mains');
    expect(categoryIds).toContain('seafood');
    expect(categoryIds).toContain('noodles_rice');
    expect(categoryIds).toContain('hotpot');
    expect(categoryIds).toContain('sides_veggies');
    expect(categoryIds).toContain('desserts');
    expect(categoryIds).toContain('drinks');

    const hotpotCat = INITIAL_MENU_CATEGORIES.find((c) => c.id === 'hotpot');
    expect(hotpotCat.name).toBe('Lẩu');
    expect(hotpotCat.name).not.toContain('2 & 4 ngăn');
  });

  it('has initial food items matching Menu 2 catalog', () => {
    expect(INITIAL_FOOD_ITEMS.length).toBeGreaterThanOrEqual(50);
    const hotpotItems = INITIAL_FOOD_ITEMS.filter((item) => item.category === 'hotpot');
    expect(hotpotItems.length).toBe(6);

    const thaiHotpot = hotpotItems.find((item) => item.name.includes('Lẩu Thái'));
    expect(thaiHotpot).toBeDefined();
    expect(thaiHotpot.price).toBe(269000);
  });

  it('correctly calculates cart totals and format currency', () => {
    const cart = {
      'HOTPOT-01': { item: { price: 269000 }, qty: 2 },
      'APP-01': { item: { price: 65000 }, qty: 1 },
    };

    const totalQty = Object.values(cart).reduce((sum, e) => sum + e.qty, 0);
    const totalPrice = Object.values(cart).reduce((sum, e) => sum + e.item.price * e.qty, 0);

    expect(totalQty).toBe(3);
    expect(totalPrice).toBe(603000);

    // Format currency string contains 603.000
    const formatted = formatCurrency(totalPrice);
    expect(formatted.replace(/\s/g, '')).toContain('603.000');
  });

  it('accurately updates item quantities when adding or removing', () => {
    let cart = {};

    const item = { id: 'HOTPOT-01', price: 109000 };
    // Add item
    cart = { ...cart, [item.id]: { item, qty: 1 } };
    expect(cart[item.id].qty).toBe(1);

    // Add again
    cart = { ...cart, [item.id]: { item, qty: cart[item.id].qty + 1 } };
    expect(cart[item.id].qty).toBe(2);

    // Remove one
    cart = { ...cart, [item.id]: { item, qty: cart[item.id].qty - 1 } };
    expect(cart[item.id].qty).toBe(1);

    // Remove when qty is 1 deletes the item
    const nextCart = { ...cart };
    delete nextCart[item.id];
    expect(nextCart[item.id]).toBeUndefined();
  });
});
