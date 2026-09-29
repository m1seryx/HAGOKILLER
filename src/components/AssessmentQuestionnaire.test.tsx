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
  it('waits for persistence and saves selections with trimmed notes', async () => {
    let finish!: () => void;
    const onSave = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    act(() => { renderer = create(<AssessmentQuestionnaire onSave={onSave} />); });
    act(() => button(renderer.root, 'Exercise today').props.onPress());
    act(() => renderer.root.findByType(TextInput).props.onChangeText('  Walked after lunch  '));
    let pending: Promise<void>;
    act(() => { pending = button(renderer.root, 'Save check-in').props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ activities: ['exercise'], otherActivityNote: 'Walked after lunch' });
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

  it('preserves a draft when the parent sends an equivalent activities array', () => {
    const onSave = jest.fn();
    act(() => { renderer = create(<AssessmentQuestionnaire initialActivities={[]} onSave={onSave} />); });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('Unsaved note'));
    act(() => button(renderer.root, 'Exercise today').props.onPress());
    act(() => { renderer.update(<AssessmentQuestionnaire initialActivities={[]} onSave={onSave} />); });
    expect(renderer.root.findByType(TextInput).props.value).toBe('Unsaved note');
    expect(button(renderer.root, 'Exercise today').props.accessibilityState.checked).toBe(true);
  });

  it('saves a skipped day without the unsaved draft', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    act(() => { renderer = create(<AssessmentQuestionnaire onSave={onSave} />); });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('Draft'));
    await act(async () => { await button(renderer.root, 'Skip for today').props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ activities: [] });
    expect(JSON.stringify(renderer.toJSON())).toContain('Skipped for today');
  });

  it('restores previously saved activities and allows deselection', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    act(() => { renderer = create(<AssessmentQuestionnaire initialActivities={['exercise']} initialOtherNote="Saved note" savedForToday onSave={onSave} />); });
    act(() => button(renderer.root, 'Edit check-in').props.onPress());
    expect(renderer.root.findByType(TextInput).props.value).toBe('Saved note');
    expect(button(renderer.root, 'Exercise today').props.accessibilityState.checked).toBe(true);
    act(() => button(renderer.root, 'Exercise today').props.onPress());
    await act(async () => { await button(renderer.root, 'Save check-in').props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ activities: [], otherActivityNote: 'Saved note' });
  });
});
