import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
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
              <Text style={styles.rangeLabel}>From</Text>
              <TouchableOpacity style={styles.rangeInputButton} onPress={() => { setPickerDate(moment(from).toDate()); setPickerVisible('from'); }}>
                <FontAwesome5 name="calendar-alt" size={12} color="#6366f1" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{from}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>To</Text>
              <TouchableOpacity style={styles.rangeInputButton} onPress={() => { setPickerDate(moment(to).toDate()); setPickerVisible('to'); }}>
                <FontAwesome5 name="calendar-alt" size={12} color="#6366f1" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{to}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <FontAwesome5 name="check" size={12} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal transparent visible={pickerVisible !== null} animationType="fade" onRequestClose={() => setPickerVisible(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPickerVisible(null)} activeOpacity={1}>
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

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
              <TouchableOpacity 
                style={[styles.applyButton, { flex: 1 }]} 
                onPress={() => { 
                  if (pickerVisible === 'from') setFrom(moment(pickerDate).format('YYYY-MM-DD')); 
                  if (pickerVisible === 'to') setTo(moment(pickerDate).format('YYYY-MM-DD')); 
                  setPickerVisible(null); 
                }}
              >
                <Text style={styles.applyText}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyButton, { backgroundColor: '#4b5563', flex: 1 }]} onPress={() => setPickerVisible(null)}>
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
  rangeInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d3d5c',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
  },
  applyButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: '#00000088', 
    justifyContent: 'center', 
    paddingHorizontal: 32,
  },
  modalMenu: { 
    backgroundColor: '#2d2d44', 
    borderRadius: 14, 
    overflow: 'hidden', 
    padding: 12,
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  modalTitle: { 
    fontSize: 14, 
    color: '#ffffff', 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    textAlign: 'center',
    flex: 1,
  },
  smallButtonText: { 
    color: '#6366f1', 
    fontSize: 16, 
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  calendarHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
    marginBottom: 8,
  },
  weekdayRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 6, 
    marginTop: 6,
  },
  weekdayText: { 
    width: 32, 
    textAlign: 'center', 
    color: '#9ca3af', 
    fontSize: 12,
    fontWeight: '600',
  },
  dayGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 6, 
    marginTop: 8,
  },
  dayCell: { 
    width: 32, 
    height: 36, 
    justifyContent: 'center', 
    alignItems: 'center', 
    margin: 2, 
    borderRadius: 6,
  },
  dayCellText: { 
    color: '#e5e7eb',
    fontSize: 13,
  },
  dayCellSelected: { 
    backgroundColor: '#6366f1',
  },
});
