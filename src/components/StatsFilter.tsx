import React, { useState } from 'react';
<<<<<<< HEAD
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
=======
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
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
  const [pickerVisible, setPickerVisible] = useState<null | 'from' | 'to'>(null);
  const [pickerDate, setPickerDate] = useState(moment().toDate());

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
<<<<<<< HEAD
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
=======
              <Text style={styles.rangeLabel}>From</Text>
              <TouchableOpacity style={styles.rangeInput} onPress={() => { setPickerDate(moment(from).toDate()); setPickerVisible('from'); }}>
                <Text style={{ color: '#fff' }}>{from}</Text>
              </TouchableOpacity>
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
            </View>

            <View style={styles.rangeField}>
<<<<<<< HEAD
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
=======
              <Text style={styles.rangeLabel}>To</Text>
              <TouchableOpacity style={styles.rangeInput} onPress={() => { setPickerDate(moment(to).toDate()); setPickerVisible('to'); }}>
                <Text style={{ color: '#fff' }}>{to}</Text>
              </TouchableOpacity>
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
            </View>

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <FontAwesome5 name="check" size={12} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal transparent visible={pickerVisible !== null} animationType="fade" onRequestClose={() => setPickerVisible(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPickerVisible(null)}>
          <View style={styles.modalMenu}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setPickerDate(moment(pickerDate).subtract(1, 'month').toDate())}>
                <Text style={styles.smallButtonText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{moment(pickerDate).format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setPickerDate(moment(pickerDate).add(1, 'month').toDate())}>
                <Text style={styles.smallButtonText}>▶</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <Text key={d} style={styles.weekdayText}>{d}</Text>
              ))}
            </View>

            <View style={styles.dayGrid}>
              {(() => {
                const start = moment(pickerDate).startOf('month');
                const daysInMonth = moment(pickerDate).daysInMonth();
                const startWeek = start.day();
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < startWeek; i++) cells.push(<View key={`b-${i}`} style={styles.dayCell} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const date = moment(start).date(d);
                  const isSelected = date.isSame(moment(pickerDate), 'day');
                  cells.push(
                    <TouchableOpacity
                      key={`d-${d}`}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => setPickerDate(date.toDate())}
                    >
                      <Text style={[styles.dayCellText, isSelected && { color: '#fff', fontWeight: '800' }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                }
                return cells;
              })()}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <TouchableOpacity style={styles.applyButton} onPress={() => { if (pickerVisible === 'from') setFrom(moment(pickerDate).format('YYYY-MM-DD')); if (pickerVisible === 'to') setTo(moment(pickerDate).format('YYYY-MM-DD')); setPickerVisible(null); }}>
                <Text style={styles.applyText}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyButton, { backgroundColor: '#6b7280' }]} onPress={() => setPickerVisible(null)}>
                <Text style={styles.applyText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
<<<<<<< HEAD
=======
  applyText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', paddingHorizontal: 32 },
  modalMenu: { backgroundColor: '#2d2d44', borderRadius: 14, overflow: 'hidden', padding: 12 },
  modalTitle: { fontSize: 12, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', paddingHorizontal: 12, paddingVertical: 8 },
  smallButton: { backgroundColor: '#3d3d5c', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  smallButtonText: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 6 },
  weekdayText: { width: 32, textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, marginTop: 8 },
  dayCell: { width: 32, height: 36, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 6 },
  dayCellText: { color: '#e5e7eb' },
  dayCellSelected: { backgroundColor: '#3b82f6' },
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
});
