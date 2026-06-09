import assert from 'node:assert/strict';
import test from 'node:test';

import { createObservers } from '../src/runtime/observers.js';

test('emits values to every subscriber', () => {
  const observers = createObservers<number>('test');
  const received: number[] = [];

  observers.add((value) => received.push(value));
  observers.add((value) => received.push(value * 2));
  observers.emit(5);

  assert.deepEqual(received, [5, 10]);
});

test('unsubscribe stops further emissions to that listener', () => {
  const observers = createObservers<number>('test');
  const received: number[] = [];

  const unsubscribe = observers.add((value) => received.push(value));
  observers.emit(1);
  unsubscribe();
  observers.emit(2);

  assert.deepEqual(received, [1]);
});

test('a throwing observer does not stop the others', () => {
  const observers = createObservers<number>('test');
  const received: number[] = [];

  observers.add(() => {
    throw new Error('boom');
  });
  observers.add((value) => received.push(value));
  observers.emit(7);

  assert.deepEqual(received, [7]);
});
