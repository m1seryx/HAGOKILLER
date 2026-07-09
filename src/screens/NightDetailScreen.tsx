import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ProgressChart } from 'react-native-chart-kit';
import { useRoute, useNavigation } from '@react-navigation/native';
import moment from 'moment';

export const NightDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  // We expect { date: 'YYYY-MM-DD' } in params. Default to today if missing.
  const dateParam = (route.params as any)?.date || moment().format('YYYY-MM-DD');
  
  const displayDate = moment(dateParam).format('dddd, MMMM Do');

  // Mock timeline data
  const timelineEvents = [
    { time: '11:30 PM', type: 'sleep', title: 'Fell Asleep', icon: 'moon', color: '#6366f1' },
    { time: '01:15 AM', type: 'snore', title: 'Heavy Snoring Detected (65 dB)', icon: 'wave-square', color: '#ef4444' },
    { time: '01:16 AM', type: 'intervention', title: 'Pillow Inflated to Level 3', icon: 'wind', color: '#10b981' },
    { time: '03:45 AM', type: 'snore', title: 'Mild Snoring Detected (45 dB)', icon: 'wave-square', color: '#f59e0b' },
    { time: '06:30 AM', type: 'wake', title: 'Woke Up', icon: 'sun', color: '#3b82f6' },
  ];

  // Sleep Score Chart Data
  const scoreData = {
    labels: ['Deep', 'Light', 'REM'], // optional
    data: [0.35, 0.45, 0.20],
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <FontAwesome5 name="chevron-left" size={16} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>Night Detail</Text>
          <Text style={styles.dateSubtitle}>{displayDate}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Sleep Score Section */}
        <View style={styles.scoreCard}>
          <Text style={styles.sectionTitle}>Sleep Composition</Text>
          <View style={styles.chartContainer}>
            <ProgressChart
              data={scoreData}
              width={300}
              height={140}
              strokeWidth={12}
              radius={24}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: 'rgba(26, 27, 38, 0)',
                backgroundGradientTo: 'rgba(26, 27, 38, 0)',
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              }}
              hideLegend={false}
            />
          </View>
          <Text style={styles.scoreSummary}>
            Overall Sleep Quality: <Text style={{ color: '#10b981', fontWeight: 'bold' }}>Good</Text>. You spent 35% of the night in Deep Sleep.
          </Text>
        </View>

        {/* Timeline Section */}
        <Text style={[styles.sectionTitle, { marginLeft: 4, marginBottom: 16 }]}>Timeline of Events</Text>
        <View style={styles.timelineContainer}>
          {timelineEvents.map((event, index) => (
            <View key={index} style={styles.timelineRow}>
              
              <View style={styles.timeColumn}>
                <Text style={styles.timeText}>{event.time.split(' ')[0]}</Text>
                <Text style={styles.ampmText}>{event.time.split(' ')[1]}</Text>
              </View>
              
              <View style={styles.lineColumn}>
                <View style={[styles.dot, { backgroundColor: event.color }]} />
                {index !== timelineEvents.length - 1 && <View style={styles.verticalLine} />}
              </View>
              
              <View style={styles.contentColumn}>
                <View style={styles.eventCard}>
                  <View style={[styles.iconWrapper, { backgroundColor: event.color + '1a' }]}>
                    <FontAwesome5 name={event.icon} size={14} color={event.color} />
                  </View>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                </View>

                {/* Mock Audio Player for Snore events */}
                {event.type === 'snore' && (
                  <View style={styles.audioPlayer}>
                    <TouchableOpacity style={styles.playButton}>
                      <FontAwesome5 name="play" size={10} color="#6366f1" />
                    </TouchableOpacity>
                    <View style={styles.waveform}>
                      {[...Array(12)].map((_, i) => (
                        <View key={i} style={[
                          styles.waveBar, 
                          { height: 4 + Math.random() * 12, backgroundColor: event.color }
                        ]} />
                      ))}
                    </View>
                    <Text style={styles.audioDuration}>0:04</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  dateSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scoreCard: {
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  scoreSummary: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  timelineContainer: {
    marginLeft: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timeColumn: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  ampmText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  lineColumn: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 2,
  },
  verticalLine: {
    position: 'absolute',
    top: 12,
    bottom: -36, // extend to next row
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    zIndex: 1,
  },
  contentColumn: {
    flex: 1,
    paddingLeft: 16,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 24,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    paddingLeft: 2,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDuration: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
    marginLeft: 12,
    marginRight: 8,
  }
});
