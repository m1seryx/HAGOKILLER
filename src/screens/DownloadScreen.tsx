import React, { useEffect } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

const DEFAULT_APK_URL =
  'https://github.com/m1seryx/HAGOKILLER/releases/latest/download/HAGOKILLER.apk';
const CONFIGURED_APK_URL = (process.env.EXPO_PUBLIC_ANDROID_APK_URL ?? '').trim();
const APK_URL = CONFIGURED_APK_URL || DEFAULT_APK_URL;

const FEATURES: Array<{
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  eyebrow: string;
  title: string;
  body: string;
  art: number;
}> = [
  {
    icon: 'wave-square',
    eyebrow: 'LIVE SLEEP SIGNALS',
    title: 'See the night clearly',
    body: 'Turn pillow events into readable trends, nightly peaks, and intervention history.',
    art: require('../../assets/hagosaur-face-curious.png'),
  },
  {
    icon: 'bluetooth-b',
    eyebrow: 'HAGOKILLER PILLOW',
    title: 'Built around BLE',
    body: 'Pair directly with the smart pillow and keep device controls within easy reach.',
    art: require('../../assets/hagosaur-pillow-connected.png'),
  },
  {
    icon: 'shield-alt',
    eyebrow: 'PRIVATE BY DESIGN',
    title: 'Personal guidance, on device',
    body: 'Daily check-ins and wellness actions can stay on your phone after model setup.',
    art: require('../../assets/hagosaur-wellness-guide.png'),
  },
];

const INSTALL_STEPS = [
  ['1', 'Download the APK', 'Choose Download via browser and keep the file when prompted.'],
  ['2', 'Allow this installation', 'Android may ask permission for your browser to install unknown apps.'],
  ['3', 'Open HAGOKILLER', 'Finish your sleep profile, then pair your Hagokiller smart pillow.'],
];

const REQUIREMENT_GROUPS: Array<{
  icon: React.ComponentProps<typeof FontAwesome5>['name'];
  title: string;
  subtitle: string;
  items: Array<{ label: string; recommended: string; minimum: string }>;
}> = [
  {
    icon: 'android',
    title: 'Android phone',
    subtitle: 'For the HAGOKILLER preview app',
    items: [
      { label: 'OS', recommended: 'Android 10 or later', minimum: 'Android 7.0' },
      { label: 'Memory', recommended: '6 GB RAM or more', minimum: '4 GB RAM' },
      { label: 'Storage', recommended: '3 GB free space', minimum: '2 GB free space' },
      { label: 'Processor', recommended: '64-bit, 8-core 2.0 GHz+', minimum: '64-bit ARM processor' },
      { label: 'Bluetooth', recommended: 'Bluetooth 5.0 or later', minimum: 'Bluetooth 4.2 with BLE' },
    ],
  },
  {
    icon: 'cloud-download-alt',
    title: 'Download and setup',
    subtitle: 'For installation and private AI setup',
    items: [
      { label: 'Browser', recommended: 'Current Chrome or Edge', minimum: 'Modern Android browser' },
      { label: 'Network', recommended: 'Stable Wi-Fi connection', minimum: 'Internet during setup' },
      { label: 'Pillow', recommended: 'Hagokiller pillow over BLE', minimum: 'Optional for app preview' },
    ],
  },
];

export const DownloadScreen = () => {
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  const compact = width < 520;
  const starPulse = React.useRef(new Animated.Value(0.3)).current;
  const cometFlight = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Download HAGOKILLER';
    }
  }, []);

  useEffect(() => {
    const stars = Animated.loop(
      Animated.sequence([
        Animated.timing(starPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(starPulse, { toValue: 0.3, duration: 2200, useNativeDriver: true }),
      ]),
    );
    const comets = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(cometFlight, { toValue: 1, duration: 12000, useNativeDriver: true }),
        Animated.timing(cometFlight, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );

    stars.start();
    comets.start();

    return () => {
      stars.stop();
      comets.stop();
    };
  }, [cometFlight, starPulse]);

  const downloadApk = () => {
    void Linking.openURL(APK_URL);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
        <View style={styles.ambientGlowTop} pointerEvents="none" />
        <View style={styles.ambientGlowSide} pointerEvents="none" />
        <View style={styles.skyMotion} pointerEvents="none">
          <Animated.View style={[styles.motionStar, styles.motionStarOne, { opacity: starPulse }]}>
            <FontAwesome5 name="star" size={7} color="#fde68a" solid />
          </Animated.View>
          <Animated.View
            style={[
              styles.motionStar,
              styles.motionStarTwo,
              {
                opacity: starPulse.interpolate({
                  inputRange: [0.3, 1],
                  outputRange: [0.9, 0.25],
                }),
              },
            ]}
          >
            <FontAwesome5 name="star" size={5} color="#bae6fd" solid />
          </Animated.View>
          <Animated.View style={[styles.motionStar, styles.motionStarThree, { opacity: starPulse }]}>
            <FontAwesome5 name="star" size={5} color="#fef3c7" solid />
          </Animated.View>
          <Animated.View
            style={[
              styles.motionStar,
              styles.motionStarFour,
              {
                opacity: starPulse.interpolate({
                  inputRange: [0.3, 1],
                  outputRange: [0.8, 0.2],
                }),
              },
            ]}
          >
            <FontAwesome5 name="star" size={6} color="#7dd3fc" solid />
          </Animated.View>

          <Animated.View
            style={[
              styles.pageComet,
              {
                opacity: cometFlight.interpolate({
                  inputRange: [0, 0.03, 0.4, 0.46, 1],
                  outputRange: [0, 0.85, 0.85, 0, 0],
                }),
                transform: [
                  {
                    translateX: cometFlight.interpolate({
                      inputRange: [0, 0.46, 1],
                      outputRange: [-110, width + 110, width + 110],
                    }),
                  },
                  {
                    translateY: cometFlight.interpolate({
                      inputRange: [0, 0.46, 1],
                      outputRange: [0, 120, 120],
                    }),
                  },
                  { rotate: '14deg' },
                ],
              },
            ]}
          >
            <View style={styles.pageCometTail} />
            <View style={styles.pageCometHead} />
          </Animated.View>

          <Animated.View
            style={[
              styles.pageComet,
              styles.pageCometTwo,
              {
                opacity: cometFlight.interpolate({
                  inputRange: [0, 0.53, 0.59, 0.94, 1],
                  outputRange: [0, 0, 0.72, 0.72, 0],
                }),
                transform: [
                  {
                    translateX: cometFlight.interpolate({
                      inputRange: [0, 0.53, 1],
                      outputRange: [width + 100, width + 100, -130],
                    }),
                  },
                  {
                    translateY: cometFlight.interpolate({
                      inputRange: [0, 0.53, 1],
                      outputRange: [0, 0, 85],
                    }),
                  },
                  { rotate: '-12deg' },
                ],
              },
            ]}
          >
            <View style={styles.pageCometTail} />
            <View style={styles.pageCometHead} />
          </Animated.View>
        </View>

        <View style={[styles.nav, compact && styles.navCompact]}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Image
                source={require('../../assets/app-icon-hagosaur.png')}
                style={styles.brandArtwork}
                resizeMode="cover"
                accessible={false}
              />
            </View>
            <View>
              <Text style={styles.brandName}>HAGOKILLER</Text>
              {!compact ? <Text style={styles.brandSub}>SMART SLEEP COMPANION</Text> : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            {!compact ? (
              <View style={styles.previewPill}>
                <View style={styles.liveDot} />
                <Text style={styles.previewText}>ANDROID PREVIEW</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.headerDownload, compact && styles.headerDownloadCompact]}
              onPress={downloadApk}
              activeOpacity={0.86}
              accessibilityRole="link"
              accessibilityLabel="Download HAGOKILLER APK"
            >
              <FontAwesome5 name="download" size={11} color="#071126" />
              <Text style={styles.headerDownloadText}>{compact ? 'APK' : 'GET THE APK'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.hero, desktop && styles.heroDesktop]}>
          <View style={[styles.heroCopy, desktop && styles.heroCopyDesktop]}>
            <View style={styles.heroEyebrowRow}>
              <FontAwesome5 name="star" size={9} color="#fde68a" solid />
              <Text style={styles.heroEyebrow}>MEET YOUR NIGHTLY SLEEP COMPANION</Text>
            </View>
            <Text style={[styles.heroTitle, desktop && styles.heroTitleDesktop, compact && styles.heroTitleCompact]}>
              Quieter nights.{`\n`}
              <Text style={styles.heroTitleAccent}>Clearer mornings.</Text>
            </Text>
            <Text style={[styles.heroBody, desktop && styles.heroBodyDesktop]}>
              Download HAGOKILLER to understand snoring patterns, connect your smart pillow,
              and turn every night into practical wellness insights.
            </Text>

            <View style={[styles.downloadActions, compact && styles.downloadActionsCompact]}>
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel="Download HAGOKILLER Android APK via browser"
                style={styles.primaryDownload}
                onPress={downloadApk}
                activeOpacity={0.88}
              >
                <View style={styles.downloadIconWell}>
                  <FontAwesome5 name="download" size={15} color="#071126" />
                </View>
                <View style={styles.downloadCopy}>
                  <Text style={styles.primaryDownloadLabel}>Download via browser</Text>
                  <Text style={styles.primaryDownloadMeta}>Android APK · Preview release</Text>
                </View>
                <FontAwesome5 name="arrow-right" size={13} color="#071126" />
              </TouchableOpacity>

              <View
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel="Google Play download currently unavailable"
                style={[styles.storeUnavailable, compact && styles.storeUnavailableCompact]}
              >
                <FontAwesome5 name="google-play" size={20} color="#7e97b8" />
                <View style={styles.downloadCopy}>
                  <Text style={styles.storeLabel}>Google Play</Text>
                  <Text style={styles.storeMeta}>Currently not available on Play Store</Text>
                </View>
              </View>
            </View>

            <View style={styles.compatibilityRow}>
              <FontAwesome5 name="check-circle" size={11} color="#34d399" solid />
              <Text style={styles.compatibilityText}>Android 7.0+ · Direct install · Free preview</Text>
            </View>
          </View>

          <View style={[styles.heroVisual, desktop && styles.heroVisualDesktop]}>
            <View style={styles.heroOrbitLarge} />
            <View style={styles.heroOrbitSmall} />
            <View style={[styles.spark, styles.sparkOne]} />
            <View style={[styles.spark, styles.sparkTwo]} />
            <View style={[styles.spark, styles.sparkThree]} />
            <Image
              source={require('../../assets/hagosaur-download-hero.png')}
              style={[styles.heroHagosaur, compact && styles.heroHagosaurCompact]}
              resizeMode="contain"
              accessible
              accessibilityLabel="Hagosaur presenting the HAGOKILLER download"
            />
            <View style={styles.heroStatusCard}>
              <View style={styles.heroStatusIcon}>
                <FontAwesome5 name="shield-alt" size={11} color="#34d399" />
              </View>
              <View>
                <Text style={styles.heroStatusTitle}>Private sleep insights</Text>
                <Text style={styles.heroStatusMeta}>Designed for on-device guidance</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.trustStrip, compact && styles.trustStripCompact]}>
          <View style={styles.trustItem}>
            <Text style={styles.trustValue}>BLE</Text>
            <Text style={styles.trustLabel}>Smart pillow connection</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Text style={styles.trustValue}>24/7</Text>
            <Text style={styles.trustLabel}>Nightly trend history</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Text style={styles.trustValue}>LOCAL</Text>
            <Text style={styles.trustLabel}>Private AI option</Text>
          </View>
        </View>

        <View style={[styles.qrSection, desktop && styles.qrSectionDesktop]}>
          <View style={[styles.qrCopy, desktop && styles.qrCopyDesktop]}>
            <Text style={styles.sectionEyebrow}>DOWNLOAD ON ANOTHER DEVICE</Text>
            <Text style={[styles.qrTitle, compact && styles.qrTitleCompact]}>
              Scan. Download. Sleep smarter.
            </Text>
            <Text style={styles.qrBody}>
              Open your Android camera, point it at the QR code, and follow the link to the latest HAGOKILLER APK.
            </Text>
            <View style={styles.qrSafetyRow}>
              <View style={styles.qrSafetyIcon}>
                <FontAwesome5 name="shield-alt" size={11} color="#34d399" />
              </View>
              <View style={styles.qrSafetyCopy}>
                <Text style={styles.qrSafetyTitle}>Direct release link</Text>
                <Text style={styles.qrSafetyText}>The code opens the official HAGOKILLER GitHub release asset.</Text>
              </View>
            </View>
          </View>

          <View style={[styles.qrCard, compact && styles.qrCardCompact]}>
            <View style={styles.qrImageFrame}>
              <Image
                source={require('../../assets/hagokiller-download-qr.png')}
                style={styles.qrImage}
                resizeMode="contain"
                accessible
                accessibilityLabel="QR code linking to the latest HAGOKILLER Android APK"
              />
            </View>
            <View style={styles.qrCardCaption}>
              <View style={styles.qrAndroidIcon}>
                <FontAwesome5 name="android" size={15} color="#071126" />
              </View>
              <View style={styles.qrCaptionCopy}>
                <Text style={styles.qrCaptionTitle}>HAGOKILLER for Android</Text>
                <Text style={styles.qrCaptionMeta}>Scan for the latest preview APK</Text>
              </View>
            </View>
            <Text style={styles.qrUrl} selectable>
              github.com/m1seryx/HAGOKILLER/releases/latest/download/HAGOKILLER.apk
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>THE HAGOKILLER EXPERIENCE</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
            Everything your sleep routine needs.
          </Text>
          <Text style={styles.sectionLead}>
            A focused toolkit for turning pillow activity into understandable, actionable nights.
          </Text>
          <View style={[styles.featureGrid, desktop && styles.featureGridDesktop]}>
            {FEATURES.map((feature) => (
              <View key={feature.title} style={[styles.featureCard, desktop && styles.featureCardDesktop]}>
                <View style={styles.featureCardTop}>
                  <View style={styles.featureIcon}>
                    <FontAwesome5 name={feature.icon} size={17} color="#7dd3fc" solid />
                  </View>
                  <View style={styles.featureArtWell}>
                    <Image
                      source={feature.art}
                      style={styles.featureArt}
                      resizeMode="contain"
                      accessible={false}
                    />
                  </View>
                </View>
                <Text style={styles.featureEyebrow}>{feature.eyebrow}</Text>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.storySection, desktop && styles.storySectionDesktop]}>
          <View style={[styles.storyArtStage, desktop && styles.storyArtStageDesktop]}>
            <View style={styles.storyMoonGlow} />
            <Image
              source={require('../../assets/sleeping-dinosaur.png')}
              style={styles.oldHagosaurArt}
              resizeMode="contain"
              accessible
              accessibilityLabel="The original sleeping Hagosaur artwork"
            />
            <View style={styles.archiveBadge}>
              <FontAwesome5 name="star" size={8} color="#fde68a" solid />
              <Text style={styles.archiveBadgeText}>THE ORIGINAL DREAMER</Text>
            </View>
          </View>
          <View style={[styles.storyCopy, desktop && styles.storyCopyDesktop]}>
            <Text style={styles.sectionEyebrow}>OLD DREAMS, NEW TOOLS</Text>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
              Hagosaur grew up with your sleep journey.
            </Text>
            <Text style={styles.storyBody}>
              The familiar sleepy companion is still here—now joined by smarter logs, BLE pillow
              controls, and more personal wellness actions for every morning.
            </Text>
            <View style={styles.storyPoints}>
              {['Friendly sleep tracking', 'Actionable nightly patterns', 'A calmer, private experience'].map((item) => (
                <View key={item} style={styles.storyPoint}>
                  <View style={styles.storyCheck}>
                    <FontAwesome5 name="check" size={8} color="#071126" />
                  </View>
                  <Text style={styles.storyPointText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.requirementsSection}>
          <View style={[styles.requirementsShell, desktop && styles.requirementsShellDesktop]}>
            <View style={[styles.requirementsIntro, desktop && styles.requirementsIntroDesktop]}>
              <View style={styles.requirementsBrandRow}>
                <View style={styles.requirementsMark}>
                  <FontAwesome5 name="moon" size={13} color="#ffffff" solid />
                </View>
                <Text style={styles.requirementsBrand}>HAGOKILLER</Text>
              </View>
              <Text style={styles.requirementsKicker}>DEVICE CHECK</Text>
              <Text style={styles.requirementsTitle}>System{`\n`}requirements</Text>
              <Text style={styles.requirementsLead}>
                Check your phone before downloading for the smoothest pillow and AI experience.
              </Text>
              <Image
                source={require('../../assets/hagosaur-wellness-guide.png')}
                style={styles.requirementsMascot}
                resizeMode="contain"
                accessible
                accessibilityLabel="Hagosaur presenting the system requirements"
              />
            </View>

            <View style={[styles.requirementsTable, desktop && styles.requirementsTableDesktop]}>
              {desktop ? (
                <View style={styles.requirementsHeader}>
                  <Text style={styles.requirementsHeaderSpacer}>DEVICE DETAILS</Text>
                  <View style={[styles.requirementsHeaderCell, styles.recommendedHeader]}>
                    <FontAwesome5 name="star" size={9} color="#047857" solid />
                    <Text style={styles.recommendedHeaderText}>RECOMMENDED</Text>
                  </View>
                  <View style={[styles.requirementsHeaderCell, styles.minimumHeader]}>
                    <FontAwesome5 name="check" size={9} color="#b45309" />
                    <Text style={styles.minimumHeaderText}>MINIMUM</Text>
                  </View>
                </View>
              ) : null}

              {REQUIREMENT_GROUPS.map((group) => (
                <View key={group.title} style={styles.requirementGroup}>
                  <View style={styles.requirementGroupHeading}>
                    <View style={styles.requirementGroupIcon}>
                      <FontAwesome5 name={group.icon} size={16} color="#0369a1" solid />
                    </View>
                    <View>
                      <Text style={styles.requirementGroupTitle}>{group.title}</Text>
                      <Text style={styles.requirementGroupSubtitle}>{group.subtitle}</Text>
                    </View>
                  </View>

                  {group.items.map((item) => (
                    <View key={item.label} style={[styles.requirementRow, desktop && styles.requirementRowDesktop]}>
                      <View style={[styles.requirementLabelWrap, desktop && styles.requirementLabelWrapDesktop]}>
                        <Text style={styles.requirementLabel}>{item.label}</Text>
                      </View>
                      <View style={[styles.requirementValue, styles.recommendedValue, desktop && styles.requirementValueDesktop]}>
                        {!desktop ? <Text style={styles.mobileRecommendedLabel}>RECOMMENDED</Text> : null}
                        <Text style={styles.requirementValueText}>{item.recommended}</Text>
                      </View>
                      <View style={[styles.requirementValue, styles.minimumValue, desktop && styles.requirementValueDesktop]}>
                        {!desktop ? <Text style={styles.mobileMinimumLabel}>MINIMUM</Text> : null}
                        <Text style={styles.requirementValueText}>{item.minimum}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              <View style={styles.requirementsFootnote}>
                <FontAwesome5 name="info-circle" size={11} color="#0369a1" />
                <Text style={styles.requirementsFootnoteText}>
                  The on-device AI model downloads separately after installation. Performance varies by phone and available memory.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.installSection}>
          <View style={[styles.installIntro, desktop && styles.installIntroDesktop]}>
            <View style={[styles.installHeading, desktop && styles.installHeadingDesktop]}>
              <Text style={styles.sectionEyebrow}>INSTALL IN THREE STEPS</Text>
              <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>From browser to bedtime.</Text>
              <Text style={styles.installLead}>
                Hagosaur will guide you from the APK download to your first connected night.
              </Text>
            </View>
            <View style={[styles.installArtworkStage, compact && styles.installArtworkStageCompact]}>
              <View style={styles.installArtworkGlow} />
              <View style={styles.installOrbit} />
              <Image
                source={require('../../assets/hagosaur-pillow-connected.png')}
                style={[styles.installArtwork, compact && styles.installArtworkCompact]}
                resizeMode="contain"
                accessible
                accessibilityLabel="Hagosaur ready to connect the smart pillow"
              />
              <View style={styles.installArtworkBadge}>
                <FontAwesome5 name="check" size={9} color="#071126" />
                <Text style={styles.installArtworkBadgeText}>READY TO PAIR</Text>
              </View>
            </View>
          </View>
          <View style={[styles.steps, desktop && styles.stepsDesktop]}>
            {INSTALL_STEPS.map(([number, title, body]) => (
              <View key={number} style={[styles.stepCard, desktop && styles.stepCardDesktop]}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepBody}>{body}</Text>
              </View>
            ))}
          </View>
          <View style={styles.installNotice}>
            <FontAwesome5 name="info-circle" size={13} color="#7dd3fc" />
            <Text style={styles.installNoticeText}>
              Google Play distribution is currently unavailable. Use the signed browser APK while the store release is being prepared.
            </Text>
          </View>
        </View>

        <View style={[styles.finalCta, compact && styles.finalCtaCompact]}>
          <Image
            source={require('../../assets/hagosaur-confirm-offer.png')}
            style={styles.finalMascot}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.finalCopy}>
            <Text style={styles.finalEyebrow}>READY WHEN YOU ARE</Text>
            <Text style={[styles.finalTitle, compact && styles.finalTitleCompact]}>Bring Hagosaur home tonight.</Text>
            <Text style={styles.finalBody}>Start with the Android preview and connect your smart pillow when you are ready.</Text>
          </View>
          <TouchableOpacity style={styles.finalButton} onPress={downloadApk} activeOpacity={0.88}>
            <FontAwesome5 name="download" size={13} color="#071126" />
            <Text style={styles.finalButtonText}>Download APK</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, compact && styles.footerCompact]}>
          <Text style={styles.footerBrand}>HAGOKILLER</Text>
          <Text style={styles.footerCopy}>Sleep insights and wellness guidance are not medical diagnosis.</Text>
          <Text style={styles.footerCopy}>© 2026 HAGOKILLER</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050b17' },
  scroll: { flex: 1, backgroundColor: '#050b17' },
  page: { minHeight: '100%', paddingBottom: 28, overflow: 'hidden' },
  ambientGlowTop: {
    position: 'absolute', top: -180, right: -110, width: 520, height: 520, borderRadius: 260,
    backgroundColor: 'rgba(14, 165, 233, 0.11)',
  },
  ambientGlowSide: {
    position: 'absolute', top: 520, left: -230, width: 500, height: 500, borderRadius: 250,
    backgroundColor: 'rgba(245, 158, 11, 0.055)',
  },
  skyMotion: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 720, overflow: 'hidden', zIndex: 1,
  },
  motionStar: { position: 'absolute' },
  motionStarOne: { top: 92, left: '9%' },
  motionStarTwo: { top: 210, right: '11%' },
  motionStarThree: { top: 410, left: '44%' },
  motionStarFour: { top: 565, right: '27%' },
  pageComet: {
    position: 'absolute', top: 86, left: 0, width: 88, height: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  pageCometTwo: { top: 320 },
  pageCometTail: {
    width: 78, height: 2, borderRadius: 2, backgroundColor: '#7dd3fc',
    shadowColor: '#38bdf8', shadowOpacity: 0.75, shadowRadius: 6,
  },
  pageCometHead: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#fef3c7', marginLeft: -1,
    shadowColor: '#fde68a', shadowOpacity: 0.9, shadowRadius: 7,
  },
  nav: {
    width: '92%', maxWidth: 1180, alignSelf: 'center', marginTop: 14, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.22)',
    backgroundColor: 'rgba(8, 24, 48, 0.88)', shadowColor: '#020617', shadowOpacity: 0.35, shadowRadius: 18,
  },
  navCompact: { width: '94%', marginTop: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 16 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandMark: {
    width: 42, height: 42, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0284c7', marginRight: 11, borderWidth: 1, borderColor: '#38bdf8',
  },
  brandArtwork: { width: '100%', height: '100%' },
  brandName: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  brandSub: { color: '#6f89a9', fontSize: 7, fontWeight: '800', letterSpacing: 1.25, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  previewPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 999, backgroundColor: 'rgba(16, 36, 66, 0.76)', borderWidth: 1, borderColor: '#294a78', marginRight: 9,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399', marginRight: 7 },
  previewText: { color: '#a9bfdf', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  headerDownload: {
    minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15,
    borderRadius: 12, backgroundColor: '#38bdf8', shadowColor: '#0ea5e9', shadowOpacity: 0.28, shadowRadius: 10,
  },
  headerDownloadCompact: { minHeight: 36, paddingHorizontal: 12 },
  headerDownloadText: { color: '#071126', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginLeft: 7 },
  hero: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 26, zIndex: 2 },
  heroDesktop: { minHeight: 660, flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  heroCopy: { zIndex: 2 },
  heroCopyDesktop: { width: '52%', paddingRight: 24 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  heroEyebrow: { color: '#7dd3fc', fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginLeft: 8 },
  heroTitle: { color: '#f8fbff', fontSize: 46, lineHeight: 50, fontWeight: '900', letterSpacing: -1.5 },
  heroTitleDesktop: { fontSize: 68, lineHeight: 72, letterSpacing: -2.5 },
  heroTitleCompact: { fontSize: 38, lineHeight: 42 },
  heroTitleAccent: { color: '#38bdf8' },
  heroBody: { color: '#a9bfdf', fontSize: 15, lineHeight: 24, marginTop: 20, maxWidth: 620 },
  heroBodyDesktop: { fontSize: 17, lineHeight: 27, maxWidth: 570 },
  downloadActions: { flexDirection: 'row', alignItems: 'stretch', marginTop: 28 },
  downloadActionsCompact: { flexDirection: 'column' },
  primaryDownload: {
    minHeight: 64, minWidth: 260, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15,
    borderRadius: 18, backgroundColor: '#38bdf8', marginRight: 10, shadowColor: '#0ea5e9',
    shadowOpacity: 0.3, shadowRadius: 18,
  },
  downloadIconWell: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)', marginRight: 11,
  },
  downloadCopy: { flex: 1 },
  primaryDownloadLabel: { color: '#071126', fontSize: 14, fontWeight: '900' },
  primaryDownloadMeta: { color: '#164e73', fontSize: 9, fontWeight: '700', marginTop: 3 },
  storeUnavailable: {
    minHeight: 64, minWidth: 205, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17,
    borderRadius: 18, backgroundColor: 'rgba(16, 36, 66, 0.72)', borderWidth: 1, borderColor: '#294a78',
  },
  storeUnavailableCompact: { marginTop: 10 },
  storeLabel: { color: '#a9bfdf', fontSize: 13, fontWeight: '800', marginLeft: 12 },
  storeMeta: { color: '#6f89a9', fontSize: 9, marginLeft: 12, marginTop: 3 },
  compatibilityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  compatibilityText: { color: '#7890aa', fontSize: 10, fontWeight: '700', marginLeft: 7 },
  heroVisual: { minHeight: 470, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  heroVisualDesktop: { width: '48%', minHeight: 620, marginTop: 0 },
  heroOrbitLarge: {
    position: 'absolute', width: '88%', aspectRatio: 1, borderRadius: 999, borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)', transform: [{ rotate: '-12deg' }],
  },
  heroOrbitSmall: {
    position: 'absolute', width: '68%', aspectRatio: 1, borderRadius: 999, borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.2)', transform: [{ rotate: '18deg' }],
  },
  heroHagosaur: { width: '100%', height: 590, zIndex: 2 },
  heroHagosaurCompact: { height: 440 },
  spark: { position: 'absolute', width: 7, height: 7, borderRadius: 2, backgroundColor: '#fde68a', transform: [{ rotate: '45deg' }] },
  sparkOne: { top: '11%', left: '14%' },
  sparkTwo: { top: '22%', right: '8%', width: 5, height: 5, backgroundColor: '#7dd3fc' },
  sparkThree: { bottom: '20%', right: '11%', width: 9, height: 9 },
  heroStatusCard: {
    position: 'absolute', zIndex: 4, bottom: 34, left: 8, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, backgroundColor: 'rgba(7, 17, 38, 0.9)',
    borderWidth: 1, borderColor: '#294a78',
  },
  heroStatusIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52, 211, 153, 0.12)', marginRight: 9 },
  heroStatusTitle: { color: '#e0f2fe', fontSize: 10, fontWeight: '800' },
  heroStatusMeta: { color: '#7890aa', fontSize: 8, marginTop: 2 },
  trustStrip: {
    width: '90%', maxWidth: 1040, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 22, paddingHorizontal: 18, borderRadius: 22, backgroundColor: 'rgba(16, 36, 66, 0.58)',
    borderWidth: 1, borderColor: '#294a78', marginTop: 18,
  },
  trustStripCompact: { width: '92%', paddingHorizontal: 8 },
  trustItem: { flex: 1, alignItems: 'center' },
  trustValue: { color: '#7dd3fc', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  trustLabel: { color: '#7890aa', fontSize: 9, textAlign: 'center', marginTop: 5 },
  trustDivider: { width: 1, height: 34, backgroundColor: '#294a78' },
  qrSection: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 100, paddingBottom: 30 },
  qrSectionDesktop: { flexDirection: 'row', alignItems: 'center' },
  qrCopy: { paddingBottom: 30 },
  qrCopyDesktop: { width: '57%', paddingRight: 72, paddingBottom: 0 },
  qrTitle: { color: '#f8fbff', fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1 },
  qrTitleCompact: { fontSize: 29, lineHeight: 34 },
  qrBody: { color: '#8fa8c7', fontSize: 14, lineHeight: 22, marginTop: 14, maxWidth: 560 },
  qrSafetyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  qrSafetyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52, 211, 153, 0.1)', borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.2)', marginRight: 10 },
  qrSafetyCopy: { flex: 1 },
  qrSafetyTitle: { color: '#d9e8f7', fontSize: 11, fontWeight: '800' },
  qrSafetyText: { color: '#6f89a9', fontSize: 9, lineHeight: 14, marginTop: 2 },
  qrCard: { width: '43%', maxWidth: 390, alignSelf: 'center', padding: 18, borderRadius: 26, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#bae6fd', shadowColor: '#0ea5e9', shadowOpacity: 0.2, shadowRadius: 24 },
  qrCardCompact: { width: '100%' },
  qrImageFrame: { width: '100%', aspectRatio: 1, padding: 8, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce7ef' },
  qrImage: { width: '100%', height: '100%' },
  qrCardCaption: { flexDirection: 'row', alignItems: 'center', paddingTop: 14 },
  qrAndroidIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7dd3fc', marginRight: 10 },
  qrCaptionCopy: { flex: 1 },
  qrCaptionTitle: { color: '#142c43', fontSize: 12, fontWeight: '900' },
  qrCaptionMeta: { color: '#52677b', fontSize: 9, marginTop: 3 },
  qrUrl: { color: '#647b90', fontSize: 8, lineHeight: 12, marginTop: 12 },
  section: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 110, paddingBottom: 74 },
  sectionEyebrow: { color: '#38bdf8', fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 },
  sectionTitle: { color: '#f8fbff', fontSize: 38, lineHeight: 44, fontWeight: '900', letterSpacing: -1 },
  sectionTitleCompact: { fontSize: 29, lineHeight: 35 },
  sectionLead: { color: '#8fa8c7', fontSize: 14, lineHeight: 22, marginTop: 12, maxWidth: 590 },
  featureGrid: { marginTop: 34 },
  featureGridDesktop: { flexDirection: 'row' },
  featureCard: { padding: 24, borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(16, 36, 66, 0.62)', borderWidth: 1, borderColor: '#294a78', marginBottom: 14 },
  featureCardDesktop: { flex: 1, marginRight: 14, minHeight: 290 },
  featureCardTop: { minHeight: 92, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14, 165, 233, 0.13)' },
  featureArtWell: {
    width: 108, height: 88, marginTop: -13, marginRight: -12, borderBottomLeftRadius: 48,
    backgroundColor: 'rgba(56, 189, 248, 0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  featureArt: { width: 112, height: 105 },
  featureEyebrow: { color: '#6f89a9', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  featureTitle: { color: '#f8fbff', fontSize: 20, fontWeight: '900', marginBottom: 10 },
  featureBody: { color: '#8fa8c7', fontSize: 13, lineHeight: 21 },
  storySection: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 70 },
  storySectionDesktop: { flexDirection: 'row', alignItems: 'center' },
  storyArtStage: { minHeight: 380, borderRadius: 30, overflow: 'hidden', backgroundColor: '#071126', borderWidth: 1, borderColor: '#294a78', alignItems: 'center', justifyContent: 'center' },
  storyArtStageDesktop: { width: '52%', minHeight: 500 },
  storyMoonGlow: { position: 'absolute', width: 360, height: 280, borderRadius: 180, backgroundColor: 'rgba(245, 158, 11, 0.09)' },
  oldHagosaurArt: { width: '112%', height: 470 },
  archiveBadge: { position: 'absolute', left: 18, bottom: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(7, 17, 38, 0.88)', borderWidth: 1, borderColor: '#294a78' },
  archiveBadgeText: { color: '#d9e8f7', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginLeft: 7 },
  storyCopy: { paddingTop: 30 },
  storyCopyDesktop: { width: '48%', paddingTop: 0, paddingLeft: 58 },
  storyBody: { color: '#8fa8c7', fontSize: 14, lineHeight: 23, marginTop: 18 },
  storyPoints: { marginTop: 24 },
  storyPoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  storyCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#38bdf8', marginRight: 10 },
  storyPointText: { color: '#d9e8f7', fontSize: 12, fontWeight: '700' },
  requirementsSection: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 80 },
  requirementsShell: { overflow: 'hidden', borderRadius: 28, backgroundColor: '#eef8ff', borderWidth: 1, borderColor: '#9bd5f2' },
  requirementsShellDesktop: { flexDirection: 'row', minHeight: 690 },
  requirementsIntro: { paddingHorizontal: 24, paddingTop: 26, backgroundColor: '#d8f0ff', overflow: 'hidden' },
  requirementsIntroDesktop: { width: '30%', paddingHorizontal: 30, paddingTop: 34 },
  requirementsBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 44 },
  requirementsMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0284c7', marginRight: 9 },
  requirementsBrand: { color: '#075985', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  requirementsKicker: { color: '#0284c7', fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginBottom: 7 },
  requirementsTitle: { color: '#0c4a6e', fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.3, textTransform: 'uppercase' },
  requirementsLead: { color: '#3f6f8d', fontSize: 12, lineHeight: 18, marginTop: 14, maxWidth: 280 },
  requirementsMascot: { width: '112%', height: 340, alignSelf: 'center', marginTop: 10, marginBottom: -26 },
  requirementsTable: { paddingHorizontal: 16, paddingVertical: 22 },
  requirementsTableDesktop: { width: '70%', paddingHorizontal: 24, paddingVertical: 30 },
  requirementsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 8 },
  requirementsHeaderSpacer: { width: '22%', color: '#6790aa', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  requirementsHeaderCell: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginLeft: 8 },
  recommendedHeader: { backgroundColor: '#d1fae5' },
  minimumHeader: { backgroundColor: '#fef3c7' },
  recommendedHeaderText: { color: '#047857', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginLeft: 7 },
  minimumHeaderText: { color: '#b45309', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginLeft: 7 },
  requirementGroup: { marginBottom: 24 },
  requirementGroupHeading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#c7e4f3' },
  requirementGroupIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d8f0ff', marginRight: 10 },
  requirementGroupTitle: { color: '#123e59', fontSize: 14, fontWeight: '900' },
  requirementGroupSubtitle: { color: '#6790aa', fontSize: 9, marginTop: 3 },
  requirementRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#d7ebf6' },
  requirementRowDesktop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  requirementLabelWrap: { marginBottom: 8 },
  requirementLabelWrapDesktop: { width: '22%', marginBottom: 0 },
  requirementLabel: { color: '#075985', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  requirementValue: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 7 },
  requirementValueDesktop: { marginLeft: 8, marginBottom: 0 },
  recommendedValue: { backgroundColor: 'rgba(209, 250, 229, 0.56)' },
  minimumValue: { backgroundColor: 'rgba(254, 243, 199, 0.58)' },
  requirementValueText: { color: '#345b73', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  mobileRecommendedLabel: { color: '#047857', fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginBottom: 4 },
  mobileMinimumLabel: { color: '#b45309', fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginBottom: 4 },
  requirementsFootnote: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: '#dff2fc' },
  requirementsFootnoteText: { flex: 1, color: '#487089', fontSize: 9, lineHeight: 14, marginLeft: 8 },
  installSection: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 90 },
  installIntro: { marginBottom: 12 },
  installIntroDesktop: { minHeight: 260, flexDirection: 'row', alignItems: 'center' },
  installHeading: { maxWidth: 680 },
  installHeadingDesktop: { width: '58%', paddingRight: 34 },
  installLead: { color: '#8fa8c7', fontSize: 13, lineHeight: 21, marginTop: 14, maxWidth: 530 },
  installArtworkStage: {
    flex: 1, minHeight: 250, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderRadius: 28, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.25)',
    backgroundColor: 'rgba(16, 36, 66, 0.58)',
  },
  installArtworkStageCompact: { minHeight: 220, marginTop: 26 },
  installArtworkGlow: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  installOrbit: {
    position: 'absolute', width: 250, height: 150, borderRadius: 125, borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.2)', transform: [{ rotate: '-10deg' }],
  },
  installArtwork: { width: '90%', height: 280, marginBottom: -24 },
  installArtworkCompact: { width: '100%', height: 240 },
  installArtworkBadge: {
    position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#34d399',
  },
  installArtworkBadgeText: { color: '#071126', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginLeft: 6 },
  steps: { marginTop: 32 },
  stepsDesktop: { flexDirection: 'row' },
  stepCard: { padding: 22, borderBottomWidth: 1, borderBottomColor: '#294a78' },
  stepCardDesktop: { flex: 1, marginRight: 16, borderWidth: 1, borderColor: '#294a78', borderRadius: 20, backgroundColor: 'rgba(7, 17, 38, 0.55)', minHeight: 210 },
  stepNumber: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#38bdf8', marginBottom: 20 },
  stepNumberText: { color: '#071126', fontSize: 13, fontWeight: '900' },
  stepTitle: { color: '#f8fbff', fontSize: 17, fontWeight: '900', marginBottom: 9 },
  stepBody: { color: '#8fa8c7', fontSize: 12, lineHeight: 19 },
  installNotice: { flexDirection: 'row', alignItems: 'flex-start', padding: 15, borderRadius: 15, backgroundColor: 'rgba(14, 165, 233, 0.09)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)', marginTop: 22 },
  installNoticeText: { flex: 1, color: '#a9bfdf', fontSize: 11, lineHeight: 17, marginLeft: 9 },
  finalCta: { width: '90%', maxWidth: 1080, minHeight: 230, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', padding: 30, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0d3458', borderWidth: 1, borderColor: '#2b72a3' },
  finalCtaCompact: { width: '92%', padding: 22, flexDirection: 'column', alignItems: 'flex-start' },
  finalMascot: { width: 180, height: 210, marginTop: 28, marginBottom: -48, marginLeft: -8 },
  finalCopy: { flex: 1, paddingHorizontal: 22 },
  finalEyebrow: { color: '#7dd3fc', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginBottom: 7 },
  finalTitle: { color: '#ffffff', fontSize: 29, lineHeight: 34, fontWeight: '900' },
  finalTitleCompact: { fontSize: 25, lineHeight: 30 },
  finalBody: { color: '#b9d2e8', fontSize: 12, lineHeight: 19, marginTop: 8, maxWidth: 500 },
  finalButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 15, backgroundColor: '#fde68a' },
  finalButtonText: { color: '#071126', fontSize: 12, fontWeight: '900', marginLeft: 8 },
  footer: { width: '100%', maxWidth: 1180, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 70, paddingBottom: 26 },
  footerCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  footerBrand: { color: '#f8fbff', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  footerCopy: { color: '#607998', fontSize: 9, marginTop: 7 },
});
