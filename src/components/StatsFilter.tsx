import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { colors } from '../constants/theme';

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

  const handleSelectDate = () => {
    const selected = moment(pickerDate).format('YYYY-MM-DD');
    if (pickerVisible === 'from') {
      setFrom(selected);
      if (moment(selected).isAfter(moment(to), 'day')) setTo(selected);
    }
    if (pickerVisible === 'to') {
      setTo(selected);
      if (moment(selected).isBefore(moment(from), 'day')) setFrom(selected);
    }
    setPickerVisible(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.segmentedContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeFilter === filter.value }}
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
          <View style={styles.rangeHeading}>
            <View style={styles.rangeHeadingIcon}>
              <FontAwesome5 name="calendar-alt" size={13} color={colors.accentDark} />
            </View>
            <View style={styles.rangeHeadingCopy}>
              <Text style={styles.rangeTitle}>Choose a date range</Text>
              <Text style={styles.rangeHint}>Tap either date to change it</Text>
            </View>
          </View>
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>START DATE</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Change start date, currently ${moment(from).format('MMMM D, YYYY')}`}
                style={styles.rangeInputButton}
                onPress={() => { setPickerDate(moment(from).toDate()); setPickerVisible('from'); }}
              >
                <FontAwesome5 name="calendar-day" size={12} color={colors.accent} />
                <Text style={styles.rangeDateText} numberOfLines={1}>{moment(from).format('MMM D, YYYY')}</Text>
                <FontAwesome5 name="chevron-down" size={9} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangeField}>
              <Text style={styles.rangeLabel}>END DATE</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Change end date, currently ${moment(to).format('MMMM D, YYYY')}`}
                style={styles.rangeInputButton}
                onPress={() => { setPickerDate(moment(to).toDate()); setPickerVisible('to'); }}
              >
                <FontAwesome5 name="calendar-day" size={12} color={colors.accent} />
                <Text style={styles.rangeDateText} numberOfLines={1}>{moment(to).format('MMM D, YYYY')}</Text>
                <FontAwesome5 name="chevron-down" size={9} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.applyButton, styles.rangeApplyButton]}
            onPress={handleApply}
          >
            <FontAwesome5 name="check" size={12} color="#ffffff" />
            <Text style={styles.applyText}>Apply date range</Text>
          </TouchableOpacity>
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
                onPress={handleSelectDate}
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
    gap: 6,
  },
  filterButton: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 5,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  rangeContainer: {
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  rangeHeadingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: 10,
  },
  rangeHeadingCopy: { flex: 1 },
  rangeTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rangeHint: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeField: {
    flex: 1,
    minWidth: 0,
  },
  rangeLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 8,
    minHeight: 46,
    gap: 7,
  },
  rangeDateText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  applyButton: {
    flexDirection: 'row',
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  rangeApplyButton: { width: '100%', marginTop: 12, borderRadius: 11 },
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
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.surface, 
    borderRadius: 14, 
    overflow: 'hidden', 
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { 
    fontSize: 14, 
    color: colors.text, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    textAlign: 'center',
    flex: 1,
  },
  smallButtonText: { 
    color: '#0ea5e9', 
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
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  weekdayRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 6, 
    marginTop: 6,
  },
  weekdayText: { 
    width: '14.285714%',
    textAlign: 'center', 
    color: colors.textMuted, 
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
    width: '14.285714%',
    height: 36, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: 2,
    borderRadius: 6,
  },
  dayCellText: { 
    color: '#111111',
    fontSize: 13,
  },
  dayCellSelected: { 
    backgroundColor: '#0ea5e9',
  },
});
