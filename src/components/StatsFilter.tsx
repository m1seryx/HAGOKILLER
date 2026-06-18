import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import moment from 'moment';

export type TimePeriod = 'today' | 'week' | 'month' | 'range';

export interface DateRange {
  from: string;
  to: string;
}

interface StatsFilterProps {
  activeFilter: TimePeriod;
  onFilterChange: (filter: TimePeriod) => void;
  onRangeChange?: (range: DateRange) => void;
  dateRange?: DateRange;
}

export const StatsFilter: React.FC<StatsFilterProps> = ({
  activeFilter, onFilterChange, onRangeChange, dateRange,
}) => {
  const filters: { label: string; value: TimePeriod }[] = [
    { label: 'Today', value: 'today' },
    { label: '7 Days', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Date Range', value: 'range' },
  ];

  const [from, setFrom] = useState(dateRange?.from || moment().subtract(7, 'days').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dateRange?.to || moment().format('YYYY-MM-DD'));

  const handleApply = () => {
    if (moment(from).isValid() && moment(to).isValid()) {
      onRangeChange?.({ from, to });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[styles.filterButton, activeFilter === filter.value && styles.filterButtonActive]}
            onPress={() => onFilterChange(filter.value)}
          >
            <Text style={[styles.filterText, activeFilter === filter.value && styles.filterTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeFilter === 'range' && (
        <View style={styles.rangeContainer}>
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>From</Text>
              <TextInput
                style={styles.rangeInput}
                value={from}
                onChangeText={setFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6b7280"
              />
            </View>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>To</Text>
              <TextInput
                style={styles.rangeInput}
                value={to}
                onChangeText={setTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#6b7280"
              />
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  filterButton: {
    paddingHorizontal: 16, paddingVertical: 8, marginRight: 8,
    borderRadius: 8, backgroundColor: '#2d2d44', borderWidth: 1, borderColor: '#3d3d5c',
  },
  filterButtonActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  filterTextActive: { color: '#ffffff' },
  rangeContainer: { marginTop: 12 },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rangeField: { flex: 1 },
  rangeLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: '600' },
  rangeInput: {
    backgroundColor: '#2d2d44', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 8, color: '#ffffff', fontSize: 13, borderWidth: 1, borderColor: '#3d3d5c',
  },
  applyButton: {
    backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 14,
    paddingVertical: 8, justifyContent: 'center',
  },
  applyText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});
