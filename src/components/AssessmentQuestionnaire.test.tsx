import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { AssessmentQuestionnaire } from './AssessmentQuestionnaire';

const { act, create } = require('react-test-renderer');
jest.mock('@expo/vector-icons', () => ({ FontAwesome5: 'Icon' }));

const button = (root: any, label: string) => root.findAllByType(TouchableOpacity).find(
  (node: any) => node.props.accessibilityLabel === label || node.findAllByType(Text).some((text: any) => text.props.children === label),
);
let renderer: any;
afterEach(() => { if (renderer) act(() => renderer.unmount()); });

describe('daily activity check-in', () => {
  it('waits for persistence and infers activities from the written answer', async () => {
    let finish!: () => void;
    const onSave = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    act(() => { renderer = create(<AssessmentQuestionnaire onSave={onSave} />); });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('  I exercised after lunch  '));
    let pending: Promise<void>;
    act(() => { pending = button(renderer.root, 'Save check-in').props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ activities: ['exercise'], otherActivityNote: 'I exercised after lunch' });
    expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
    await act(async () => { finish(); await pending!; });
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain('Check-in saved');
  });

  it('keeps the answer editable when saving fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('storage unavailable'));
    act(() => { renderer = create(<AssessmentQuestionnaire onSave={onSave} />); });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('My daily note'));
    await act(async () => { await button(renderer.root, 'Save check-in').props.onPress(); });
    expect(renderer.root.findByType(TextInput).props.value).toBe('My daily note');
    expect(renderer.root.findByType(TextInput).props.editable).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('Could not save');
  });

  it('preserves a draft when the parent rerenders with equivalent data', () => {
    const onSave = jest.fn();
    act(() => { renderer = create(<AssessmentQuestionnaire initialActivities={[]} onSave={onSave} />); });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('Unsaved note'));
    act(() => { renderer.update(<AssessmentQuestionnaire initialActivities={[]} onSave={onSave} />); });
    expect(renderer.root.findByType(TextInput).props.value).toBe('Unsaved note');
  });

  it('saves a skipped day without the unsaved draft', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    act(() => { renderer = create(<AssessmentQuestionnaire onSave={onSave} />); });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('Draft'));
    await act(async () => { await button(renderer.root, 'Skip for today').props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ activities: [] });
    expect(JSON.stringify(renderer.toJSON())).toContain('Skipped for today');
  });

  it('restores a previously saved written answer for editing', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    act(() => { renderer = create(<AssessmentQuestionnaire initialActivities={['exercise']} initialOtherNote="Saved note" savedForToday onSave={onSave} />); });
    act(() => button(renderer.root, 'Edit check-in').props.onPress());
    expect(renderer.root.findByType(TextInput).props.value).toBe('Saved note');
    await act(async () => { await button(renderer.root, 'Save check-in').props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ activities: [], otherActivityNote: 'Saved note' });
  });
});
