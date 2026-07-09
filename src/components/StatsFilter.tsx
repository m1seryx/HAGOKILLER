import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
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
      <View style={styles.segmentedContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton, 
              activeFilter === filter.value && styles.filterButtonActive
            ]}
            onPress={() => onFilterChange(filter.value)}
          >
            <Text style={[
              styles.filterText, 
              activeFilter === filter.value && styles.filterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeFilter === 'range' && (
        <View style={styles.rangeContainer}>
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>Start Date</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="calendar-alt" size={12} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.rangeInput}
                  value={from}
                  onChangeText={setFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>End Date</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name="calendar-alt" size={12} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.rangeInput}
                  value={to}
                  onChangeText={setTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <FontAwesome5 name="check" size={12} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  rangeContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(26, 27, 38, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rangeField: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 6,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
  },
  inputIcon: {
    marginRight: 6,
  },
  rangeInput: {
    flex: 1,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  applyButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
});
